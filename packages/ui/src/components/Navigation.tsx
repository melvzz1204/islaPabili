import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppIcon } from '../icons';
import { colors, radius, spacing, typography } from '../tokens';

// --- ScreenHeader -----------------------------------------------------------

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Consistent page header: optional back chevron, title, trailing slot. */
export function ScreenHeader({ title, subtitle, onBack, right, style }: ScreenHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <AppIcon name="back" size={20} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={styles.headerText}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// --- SegmentedTabs ----------------------------------------------------------

export type Segment<T extends string> = { value: T; label: string; badge?: number };

type SegmentedTabsProps<T extends string> = {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

/** Pill-style segmented control for switching a list's scope. */
export function SegmentedTabs<T extends string>({ segments, value, onChange, style }: SegmentedTabsProps<T>) {
  return (
    <View style={[styles.segments, style]}>
      {segments.map((seg) => {
        const active = seg.value === value;
        return (
          <Pressable
            key={seg.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(seg.value)}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              pressed && !active && styles.pressed,
            ]}
          >
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{seg.label}</Text>
            {seg.badge != null && seg.badge > 0 ? (
              <View style={[styles.segmentBadge, active && styles.segmentBadgeActive]}>
                <Text style={[styles.segmentBadgeText, active && styles.segmentBadgeTextActive]}>
                  {seg.badge > 9 ? '9+' : seg.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 1 },
  headerTitle: { ...typography.title, fontSize: 21 },
  headerSubtitle: { ...typography.caption },

  segments: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 38,
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentLabel: { ...typography.label, color: colors.muted },
  segmentLabelActive: { color: colors.text },
  segmentBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBadgeActive: { backgroundColor: colors.primary },
  segmentBadgeText: { ...typography.micro, fontSize: 9.5, color: colors.body },
  segmentBadgeTextActive: { color: colors.onPrimary },

  pressed: { opacity: 0.6 },
});
