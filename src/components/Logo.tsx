import React from 'react';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme/tokens';

// The Sèvizi mark: a location pin (teardrop pointing left) + monogram S.
// Construction per charte: "Épingle de localisation + monogramme S".
export function Logo({ size = 40, fill = colors.vert, letter = colors.creme }: {
  size?: number; fill?: string; letter?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Teardrop: round on the right, pointed tip to the left */}
      <Path
        d="M 30 50 L 8 50 Q 18 22 50 22 Q 78 22 78 50 Q 78 78 50 78 Q 18 78 30 50 Z"
        fill={fill}
      />
      <SvgText
        x="52"
        y="62"
        fontSize="40"
        fontWeight="800"
        fill={letter}
        textAnchor="middle"
        fontFamily="HankenGrotesk_800ExtraBold"
      >
        S
      </SvgText>
    </Svg>
  );
}
