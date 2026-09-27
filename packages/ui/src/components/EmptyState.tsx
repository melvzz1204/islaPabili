import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon, type AppIconName } from '../icons';
import { colors, radius, spacing, typography } from '../tokens';

type EmptyStateProps = {
  title: string;
  message: string;
  icon?: AppIconName;
  action?: ReactNode;
  compact?: boolean;
};

/** Contextual empty state — never show a bare spinner or blank canvas. */
export function EmptyState({ title, message, icon = 'package', action, compact = false }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.iconRing}>
        <View style={styles.iconInner}>
          <AppIcon name={icon} size={compact ? 24 : 30} color={colors.faint} />
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  wrapCompact: { paddingVertical: spacing.xl },
  iconRing: {
    width: 84,
    height: 84,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  iconInner: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.heading, textAlign: 'center' },
  message: { ...typography.body, color: colors.muted, textAlign: 'center', maxWidth: 300 },
  action: { marginTop: spacing.md, alignSelf: 'stretch' },
});
