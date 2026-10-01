/**
 * IslaPabili design tokens, single source of truth for the MOBILE app.
 *
 * Web (admin-web / merchant-web) reads `web-tokens.css`, so changes here
 * only re-skin mobile. Mobile follows a strict 60/30/10 delivery-app system:
 *
 * - 60% DOMINANT (neutrals): crisp white / light gray / soft cream across
 *   every background, card, sheet, and content surface. Food photos and menus
 *   stay clean and legible; neutrals do the quiet work.
 * - 30% SECONDARY (brand structure): deep orange across top bars, card
 *   outlines, category headers, secondary buttons, selected states, and
 *   structural dividers. Recognizable without shouting.
 * - 10% ACCENT (conversion only): bright yellow reserved for Add to Cart,
 *   Checkout / Place Order, active delivery pins, and discount badges.
 *   Never use yellow for decoration, if everything pops, nothing pops.
 *
 * Type: Inter everywhere, tuned for small screens.
 *
 * Apps must import from `@isla/ui`, never hardcode these values in screens.
 */

// --- Brand & semantic colors ------------------------------------------------
// 60%, dominant neutrals (backgrounds, cards, sheets)
export const colors = {
  // 30%, secondary brand structure (deep orange identity).
  // Primary actions that are NOT purchases: headers, outlines, secondary
  // buttons, selected states, dividers.
  primary: '#C2410C',
  primaryDark: '#9A3412',
  primaryDeep: '#7C2D12',
  primarySoft: '#FDEBD7',
  primaryTint: '#FFF6EA',

  // 10%, conversion accent (bright yellow). Add to Cart, Checkout Now,
  // Place Order, active rider pins, discount badges ONLY.
  accent: '#FFB800',
  accentDark: '#8A5A00',
  accentSoft: '#FFF3C4',

  // 60%, canvas & surfaces (soft cream system, not cold gray).
  bg: '#FDFBF5',
  surface: '#FFFFFF',
  surfaceSunken: '#F4F0E6',
  surfaceMuted: '#FAF6EC',
  // Warm chat canvas, message thread backdrop.
  chatCanvas: '#EFE8D6',

  // Text (warm stone for cream harmony)
  text: '#1C1917',
  ink: '#1C1917',
  body: '#57534E',
  muted: '#78716C',
  faint: '#A8A29E',
  onPrimary: '#FFFFFF',
  onAccent: '#231303',

  // Lines (warm, low-contrast so cards read through shadow)
  border: '#E7E0CF',
  borderStrong: '#D9CFB8',
  hairline: '#F0EAD9',

  // Status (kept readable on cream)
  success: '#15803D',
  successSoft: '#E4F5E9',
  successDark: '#14532D',
  warn: '#B45309',
  warnSoft: '#FDF0D9',
  warnDark: '#78350F',
  danger: '#DC2626',
  dangerDark: '#991B1B',
  dangerSoft: '#FDE5E5',
  info: '#1D4ED8',
  infoSoft: '#E6EEFD',
  infoDark: '#1E3A8A',
  neutralSoft: '#F4F0E6',
  neutralDark: '#57534E',

  toastBg: '#1C1917',
  overlay: 'rgba(28, 25, 23, 0.45)',
  skeleton: '#ECE6D6',
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
// Layered and low-opacity: depth without muddiness on cream.
export const shadows = {
  none: {},
  card: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  raised: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  sticky: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 10,
  },
  fab: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  sheet: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 20,
  },
  toast: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
} as const;

// --- Fonts ------------------------------------------------------------------
// Mobile-only: Inter throughout (single family, small-screen legibility).
// Web keeps its own stack in web-tokens.css.
export const fonts = {
  display: 'Inter',
  body: 'Inter',
} as const;

// --- Typography scale -------------------------------------------------------
// Inter hierarchy: tight but comfortable line-heights for 5 to 6.5" screens.
// display/title/heading 700 for headers · body 400 · labels 600.
export const typography = {
  display: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: colors.text,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: colors.text,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: '700' as const,
    lineHeight: 23,
    letterSpacing: -0.1,
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
    lineHeight: 23,
    color: colors.body,
  },
  bodyStrong: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 23,
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
    lineHeight: 15,
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

