import React from 'react';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme/tokens';

// Sèvizi mark: classic map pin (circle + downward point) + monogram S.
export function Logo({ size = 40, fill = colors.vert, letter = colors.creme }: {
  size?: number; fill?: string; letter?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 120">
      {/* Circle top of pin */}
      <Circle cx="50" cy="45" r="35" fill={fill} />
      {/* Downward point */}
      <Path d="M 26 68 Q 50 110 74 68 Z" fill={fill} />
      {/* S monogram */}
      <SvgText
        x="50"
        y="58"
        fontSize="38"
        fontWeight="800"
        fill={letter}
        textAnchor="middle"
        fontFamily="HankenGrotesk_800ExtraBold, sans-serif"
      >
        S
      </SvgText>
    </Svg>
  );
}
