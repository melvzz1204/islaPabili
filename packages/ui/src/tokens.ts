/**
 * IslaPabili design tokens — single source of truth.
 *
 * Direction: calm, minimal, premium. Most surfaces are white on a soft
 * neutral canvas; the brand teal is an accent, not a flood. Hairlines are
 * lighter than borders so elevation reads through shadow, not outline.
 *
 * Apps must import from `@isla/ui` — never hardcode these values in screens.
 */

// --- Brand & semantic colors ------------------------------------------------
export const colors = {
  // Brand teal — used for primary actions, active states, success-trust.
  primary: '#0D9488',
  primaryDark: '#0B7C72',
  primaryDeep: '#065F59',
  primarySoft: '#E6F6F4',
  primaryTint: '#F0FAF9',

  // Warm accent — the "Pabili" action (add to cart, rider, highlights).
  accent: '#F97316',
  accentDark: '#EA580C',
  accentSoft: '#FFF4EC',

  // Canvas & surfaces
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceSunken: '#F1F3F6',
  surfaceMuted: '#F9FAFB',

  // Text
  text: '#0B1220',
  ink: '#0B1220',
  body: '#475569',
  muted: '#7A8699',
  faint: '#A3ADBD',
  onPrimary: '#FFFFFF',

  // Lines
  border: '#E7EAEF',
  borderStrong: '#D6DBE3',
  hairline: '#EFF1F4',

  // Status
  success: '#0F9D6E',
  successSoft: '#E3F7EF',
  successDark: '#046C4E',
  warn: '#D97706',
  warnSoft: '#FEF4E2',
  warnDark: '#92400E',
  danger: '#E11D48',
  dangerDark: '#9F1239',
  dangerSoft: '#FFE9EE',
  info: '#2563EB',
  infoSoft: '#E8EFFE',
  infoDark: '#1E40AF',
  neutralSoft: '#F1F3F6',
  neutralDark: '#475569',

  toastBg: '#0B1220',
  overlay: 'rgba(11, 18, 32, 0.45)',
  skeleton: '#EAEDF1',
} as const;

export type ColorName = keyof typeof colors;

// --- Spacing: 4px base grid -------------------------------------------------
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 44,
  pagePadding: 20,
  cardGap: 16,
  sectionGap: 28,
} as const;

export type SpacingName = keyof typeof spacing;

// --- Radius -----------------------------------------------------------------
export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  pill: 999,
  full: 9999,
} as const;

export type RadiusName = keyof typeof radius;

// --- Elevation --------------------------------------------------------------
// Layered and low-opacity: premium depth without muddiness.
export const shadows = {
  none: {},
  card: {
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  raised: {
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  sticky: {
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 10,
  },
  fab: {
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  sheet: {
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 20,
  },
  toast: {
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
} as const;

// --- Fonts ------------------------------------------------------------------
export const fonts = {
  display: 'PlusJakartaSans',
  body: 'Inter',
} as const;

// --- Typography scale -------------------------------------------------------
export const typography = {
  display: {
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: '700' as const,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: colors.text,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 23,
    fontWeight: '700' as const,
    lineHeight: 29,
    letterSpacing: -0.4,
    color: colors.text,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: colors.text,
  },
  subhead: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 21,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: colors.body,
  },
  bodyStrong: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: colors.text,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
    color: colors.text,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    fontWeight: '400' as const,
    lineHeight: 18,
    color: colors.muted,
  },
  micro: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 14,
    color: colors.muted,
  },
  price: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: '700' as const,
    lineHeight: 22,
    color: colors.text,
  },
} as const;

export type TypographyName = keyof typeof typography;

// --- Motion -----------------------------------------------------------------
export const motion = {
  fast: 120,
  normal: 220,
  slow: 320,
  skeleton: 1100,
  pressScale: 0.97,
} as const;

export type MotionName = keyof typeof motion;

// --- Layout metrics ---------------------------------------------------------
export const layout = {
  tabBarHeight: 62,
  stickyBarHeight: 76,
  controlHeight: 52,
  touchTarget: 48,
  hairline: 1,
} as const;
