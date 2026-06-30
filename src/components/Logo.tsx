import React from 'react';
import { Image } from 'react-native';

// Official Sèvizi mark (green map pin with S). Used as the square brand icon.
// `fill`/`letter` are accepted for backwards compatibility but no longer used
// now that we render the real brand asset.
const markSource = require('../../assets/favicon.png');

// favicon.png is 1700×2060 (portrait pin). Keep its aspect ratio at the given height.
const MARK_RATIO = 1700 / 2060;

export function Logo({ size = 40 }: { size?: number; fill?: string; letter?: string }) {
  return (
    <Image
      source={markSource}
      style={{ height: size, width: size * MARK_RATIO }}
      resizeMode="contain"
      accessibilityLabel="Sèvizi"
    />
  );
}

// Full horizontal lockup (pin + "Sèvizi" wordmark). logo.png is 2400×800 (3:1).
const fullSource = require('../../assets/logo.png');
const FULL_RATIO = 2400 / 800;

export function LogoFull({ height = 44 }: { height?: number }) {
  return (
    <Image
      source={fullSource}
      style={{ height, width: height * FULL_RATIO }}
      resizeMode="contain"
      accessibilityLabel="Sèvizi"
    />
  );
}
