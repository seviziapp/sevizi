import React from 'react';
import { categoryIcon } from '../lib/categoryIcons';
import { colors } from '../theme/tokens';
import type { ServiceCategory } from '../lib/types';

export function CategoryIcon({
  category,
  size = 20,
  color = colors.vert,
  strokeWidth = 2,
}: {
  category?: ServiceCategory | string | null;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Icon = categoryIcon(category);
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}
