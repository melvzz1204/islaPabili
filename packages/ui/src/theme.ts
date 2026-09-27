import { colors, fonts, layout, motion, radius, shadows, spacing, typography } from './tokens';

/**
 * Central theme object. Swap or extend this single object to re-skin
 * every screen (light -> dark, seasonal brand, white-label).
 */
export const lightTheme = {
  colors,
  spacing,
  radius,
  shadows,
  fonts,
  typography,
  motion,
  layout,
} as const;

export type IslaTheme = typeof lightTheme;

export const theme: IslaTheme = lightTheme;

export type { ColorName, RadiusName, SpacingName, TypographyName, MotionName } from './tokens';
