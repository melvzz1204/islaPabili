import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, layout, radius, spacing, typography } from '../tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger' | 'soft';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  size?: 'md' | 'lg';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const VARIANTS = {
  primary: { bg: colors.primary, fg: colors.onPrimary, border: 'transparent' },
  accent: { bg: colors.accent, fg: colors.onPrimary, border: 'transparent' },
  danger: { bg: colors.danger, fg: colors.onPrimary, border: 'transparent' },
  soft: { bg: colors.primarySoft, fg: colors.primaryDeep, border: 'transparent' },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.borderStrong },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
} as const;

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  size = 'lg',
  fullWidth = true,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const v = VARIANTS[variant];
  const height = size === 'lg' ? layout.controlHeight : 42;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          backgroundColor: v.bg,
          borderColor: v.border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color: v.fg }]} numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
  label: { ...typography.subhead, fontSize: 15.5, fontWeight: '700' },
});
