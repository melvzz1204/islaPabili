import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '../tokens';

export type CardVariant = 'elevated' | 'flat' | 'outlined' | 'tinted' | 'sunken';

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
  onPress?: () => void;
  padded?: boolean;
}>;

/**
 * Primary content container.
 * `elevated` is the default for cards that sit on the page canvas; use
 * `outlined`/`flat` for nested surfaces so elevation stays meaningful.
 */
export function Card({ children, style, variant = 'elevated', onPress, padded = true }: CardProps) {
  const body = (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        variant === 'flat' && styles.flat,
        variant === 'outlined' && styles.outlined,
        variant === 'tinted' && styles.tinted,
        variant === 'sunken' && styles.sunken,
        variant === 'elevated' && shadows.card,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  padded: { padding: spacing.base },
  flat: { borderColor: 'transparent' },
  outlined: { backgroundColor: 'transparent', borderColor: colors.border },
  tinted: { backgroundColor: colors.primaryTint, borderColor: colors.primarySoft },
  sunken: { backgroundColor: colors.surfaceMuted },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
