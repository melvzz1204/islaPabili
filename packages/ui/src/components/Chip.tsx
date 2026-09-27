import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../tokens';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  /** Leading count bubble, e.g. result totals. */
  count?: number;
};

/** Single-select filter chip. Use inside a horizontal `ChipRow`. */
export function Chip({ label, selected = false, onPress, count }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
      {count != null ? (
        <Text style={[styles.count, selected && styles.countSelected]}>{count}</Text>
      ) : null}
    </Pressable>
  );
}

/** Horizontally scrolling chip rail with edge padding. */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.rowScroll}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rowScroll: { marginHorizontal: -spacing.pagePadding },
  row: { gap: spacing.sm, paddingHorizontal: spacing.pagePadding },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 38,
    paddingHorizontal: spacing.base,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.text, borderColor: colors.text },
  pressed: { opacity: 0.7 },
  label: { ...typography.label, color: colors.body },
  labelSelected: { color: colors.onPrimary },
  count: { ...typography.micro, color: colors.faint },
  countSelected: { color: 'rgba(255,255,255,0.7)' },
});
