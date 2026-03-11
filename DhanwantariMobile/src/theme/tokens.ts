export const Colors = {
  // Brand
  primary: '#3B5BDB',
  primaryDark: '#2845B8',
  primaryLight: '#5C7AEA',

  // Semantic
  danger: '#D32F2F',
  dangerLight: '#EF5350',
  error: '#D32F2F',      // alias for danger — use for error states
  warning: '#F57C00',
  warningLight: '#FFA726',
  success: '#2E7D32',
  successLight: '#43A047',
  muted: '#757575',

  // Severity
  severityMild: '#2E7D32',
  severityModerate: '#F57C00',
  severitySevere: '#D32F2F',

  // Match tiers
  highMatch: '#D32F2F',
  mediumMatch: '#F57C00',
  lowMatch: '#757575',

  // Glass
  glassBg: 'rgba(255,255,255,0.12)',
  glassBorder: 'rgba(255,255,255,0.25)',
  glassHighlight: 'rgba(255,255,255,0.40)',
  glassDark: 'rgba(0,0,0,0.08)',

  // Backgrounds
  background: '#F2F4FF',
  backgroundCard: '#FFFFFF',
  backgroundDark: '#1A1F3C',
  surface: '#FFFFFF',
  white: '#FFFFFF',

  // Text
  textPrimary: '#12143A',
  textSecondary: '#5A6070',
  textMuted: '#9EA3B0',
  textInverse: '#FFFFFF',
  text: '#12143A',
  textBlue: '#3B5BDB',
  textRed: '#D32F2F',
  textGreen: '#2E7D32',
  textOrange: '#F57C00',

  // UI
  border: 'rgba(0,0,0,0.08)',
  borderLight: 'rgba(255,255,255,0.20)',
  inputBg: '#F8F9FF',
  inputBorder: '#D0D6F5',
  shadow: 'rgba(59,91,219,0.15)',
  overlay: 'rgba(18,20,58,0.50)',
} as const;

export const Typography = {
  // Font sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 34,

  // Font weights (as named weights)
  thin: '100' as const,
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,

  // Line heights
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,

  // Font families (SF Pro / system)
  fontSans: 'System',
} as const;

export const Spacing = {
  '0': 0,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
  // Semantic aliases
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: Colors.shadow,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.shadow,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: Colors.shadow,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
  glass: {
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export const Animations = {
  springFast: {damping: 18, stiffness: 300, mass: 0.8},
  springNormal: {damping: 20, stiffness: 220, mass: 1},
  springSlow: {damping: 22, stiffness: 160, mass: 1.2},
  durationFast: 150,
  durationNormal: 250,
  durationSlow: 400,
} as const;
