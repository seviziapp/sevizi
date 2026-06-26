// Sèvizi design tokens — derived directly from the Charte Graphique v1.0
// Colors, type scale, spacing, radii. Single source of truth for the app.

export const colors = {
  // Core
  vert: '#0FA76A',        // Couleur principale — Vert Sèvizi
  encre: '#06291F',       // Encre — Vert Forêt
  creme: '#FBF7EE',       // Fond — Crème
  surface: '#E6F6EE',     // Surface — Vert Pâle

  // Accents
  soleil: '#FCC419',      // Jaune Soleil
  terre: '#CE5A37',       // Terre Cuite

  // Derived / functional
  vertDark: '#0B8A57',
  vertSoft: '#D4F0E2',
  encreSoft: '#0C3A2B',   // raised surface on dark
  white: '#FFFFFF',

  // Text
  textOnLight: '#06291F',
  textMuted: '#5B6B63',
  textOnDark: '#FBF7EE',
  textMutedDark: '#8FA89C',

  // Lines / borders
  border: '#E7E2D6',
  borderDark: '#13402F',

  // States
  success: '#0FA76A',
  warning: '#FCC419',
  danger: '#CE5A37',
};

export const typography = {
  // Hanken Grotesk — titles & body
  display: 'HankenGrotesk_800ExtraBold',
  bold: 'HankenGrotesk_700Bold',
  semibold: 'HankenGrotesk_600SemiBold',
  medium: 'HankenGrotesk_500Medium',
  regular: 'HankenGrotesk_400Regular',
  light: 'HankenGrotesk_300Light',
  // Space Mono — data & coordinates
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
};

// Type scale from the charte
export const text = {
  display: { fontFamily: typography.display, fontSize: 40, lineHeight: 44 },
  h1: { fontFamily: typography.display, fontSize: 30, lineHeight: 36 },
  h2: { fontFamily: typography.bold, fontSize: 24, lineHeight: 30 },
  h3: { fontFamily: typography.semibold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: typography.regular, fontSize: 16, lineHeight: 24 },
  bodyMd: { fontFamily: typography.medium, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: typography.regular, fontSize: 14, lineHeight: 20 },
  // Labels use Space Mono, uppercase, tracked — per charte
  label: { fontFamily: typography.mono, fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  data: { fontFamily: typography.monoBold, fontSize: 14, lineHeight: 18 },
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
};

export const radii = {
  sm: 8, md: 12, lg: 16, xl: 20, pill: 999,
};

export const shadow = {
  card: {
    shadowColor: '#06291F',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
};
