import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../tokens';

export type BadgeStatus =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'accent'
  | 'outline'
  // Order-lifecycle aliases kept so status maps can be passed straight through.
  | 'pending'
  | 'transit'
  | 'delivered'
  | 'cancelled';

const STATUS_COLORS: Record<BadgeStatus, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceSunken, fg: colors.body },
  primary: { bg: colors.primarySoft, fg: colors.primaryDeep },
  success: { bg: colors.successSoft, fg: colors.successDark },
  warning: { bg: colors.warnSoft, fg: colors.warnDark },
  danger: { bg: colors.dangerSoft, fg: colors.dangerDark },
  accent: { bg: colors.accentSoft, fg: colors.accentDark },
  outline: { bg: 'transparent', fg: colors.body },
  pending: { bg: colors.warnSoft, fg: colors.warnDark },
  transit: { bg: colors.primarySoft, fg: colors.primaryDeep },
  delivered: { bg: colors.successSoft, fg: colors.successDark },
  cancelled: { bg: colors.dangerSoft, fg: colors.dangerDark },
};

type BadgeProps = {
  label: string;
  status?: BadgeStatus;
  /** Solid dot marker, useful for live/status rows. */
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Badge({ label, status = 'neutral', dot = false, style }: BadgeProps) {
  const palette = STATUS_COLORS[status];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }, status === 'outline' && styles.outline, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: palette.fg }]} /> : null}
      <Text style={[styles.text, { color: palette.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.sm,
  },
  outline: { borderWidth: 1, borderColor: colors.border },
  dot: { width: 6, height: 6, borderRadius: radius.full },
  text: { ...typography.micro, letterSpacing: 0.1 },
});
