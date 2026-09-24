export const colors = {
  primary: '#0B7A4B',
  primaryDark: '#075E39',
  primarySoft: '#E3F2EA',
  bg: '#F5F7F5',
  surface: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  danger: '#DC2626',
  warn: '#B45309',
  success: '#059669',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
};

export const typography = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 20, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  caption: { fontSize: 13, color: colors.muted },
};