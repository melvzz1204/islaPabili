import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '../icons';
import { colors, radius, spacing, typography } from '../tokens';

type OrDividerProps = { label?: string };

/** "or continue with" rule between grouped actions. */
export function OrDivider({ label }: OrDividerProps) {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.line} />
    </View>
  );
}

type SocialButtonProps = {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  loading?: boolean;
};

/** Neutral outlined social sign-in button. */
export function SocialButton({ label, icon, onPress, loading }: SocialButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [styles.social, pressed && styles.pressed, loading && styles.dim]}
    >
      {icon}
      <Text style={styles.socialLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Small inline link used under forms ("Log in instead", "Use another number"). */
export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Text style={styles.linkText}>{label}</Text>
      <AppIcon name="chevronRight" size={13} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, width: '100%' },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  label: { ...typography.caption },

  social: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.base,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  socialLabel: { ...typography.subhead, fontSize: 15, fontWeight: '600', color: colors.text },

  link: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'center', paddingVertical: spacing.xs },
  linkText: { ...typography.label, color: colors.primary },

  pressed: { opacity: 0.6 },
  dim: { opacity: 0.5 },
});
