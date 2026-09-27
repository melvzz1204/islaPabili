import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppIcon, type AppIconName } from '../icons';
import { colors, layout, radius, spacing, typography } from '../tokens';

// --- SectionHeader ----------------------------------------------------------

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Title + optional "see all" affordance that separates page sections. */
export function SectionHeader({ title, subtitle, actionLabel, onAction, style }: SectionHeaderProps) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionText}>
        <Text style={typography.heading}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}
        >
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
          <AppIcon name="chevronRight" size={14} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

// --- IconButton -------------------------------------------------------------

type IconButtonProps = {
  icon: AppIconName;
  onPress: () => void;
  label: string;
  size?: number;
  tone?: 'surface' | 'soft' | 'primary' | 'ghost';
  badge?: number;
};

/** Circular icon affordance for headers and card corners. */
export function IconButton({
  icon,
  onPress,
  label,
  size = 20,
  tone = 'surface',
  badge,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconBtn,
        tone === 'soft' && styles.iconBtnSoft,
        tone === 'primary' && styles.iconBtnPrimary,
        tone === 'ghost' && styles.iconBtnGhost,
        pressed && styles.pressed,
      ]}
    >
      <AppIcon
        name={icon}
        size={size}
        color={tone === 'primary' ? colors.onPrimary : tone === 'soft' ? colors.primary : colors.text}
      />
      {badge != null && badge > 0 ? (
        <View style={styles.iconBadge}>
          <Text style={styles.iconBadgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// --- StickyBar --------------------------------------------------------------

type StickyBarProps = {
  children: ReactNode;
  /** Nudge above the tab bar when a screen sits inside tabs. */
  elevated?: boolean;
};

/** Bottom-anchored action bar (cart total + checkout, etc.). */
export function StickyBar({ children, elevated = true }: StickyBarProps) {
  return <View style={[styles.sticky, elevated && styles.stickyShadow]}>{children}</View>;
}

// --- ListRow ----------------------------------------------------------------

type ListRowProps = {
  icon: AppIconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  value?: string;
  tone?: 'default' | 'danger';
  showChevron?: boolean;
  /** Hairline under the row — use between items in a grouped card. */
  divider?: boolean;
};

/** Settings-style row: icon, label, optional value, chevron. */
export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  value,
  tone = 'default',
  showChevron = true,
  divider = false,
}: ListRowProps) {
  const danger = tone === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        divider && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <AppIcon name={icon} size={19} color={danger ? colors.danger : colors.body} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {showChevron && onPress ? <AppIcon name="chevronRight" size={16} color={colors.faint} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Section
  section: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionText: { flex: 1, gap: 2 },
  subtitle: { ...typography.caption },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { ...typography.label, color: colors.primary },

  // IconButton
  iconBtn: {
    width: layout.touchTarget - 6,
    height: layout.touchTarget - 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnSoft: { backgroundColor: colors.surfaceSunken, borderColor: 'transparent' },
  iconBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  iconBtnGhost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  iconBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  iconBadgeText: { ...typography.micro, fontSize: 9, color: colors.onPrimary },

  // StickyBar
  sticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  stickyShadow: {
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 12,
  },

  // ListRow
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: 58,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: colors.dangerSoft },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { ...typography.bodyStrong },
  rowTitleDanger: { color: colors.danger },
  rowSubtitle: { ...typography.caption },
  rowValue: { ...typography.caption, color: colors.text },

  pressed: { opacity: 0.6 },
});
