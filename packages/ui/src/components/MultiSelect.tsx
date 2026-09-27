import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '../icons';
import { colors, radius, spacing, typography } from '../tokens';

export type MultiSelectOption<T extends string> = {
  value: T;
  label: string;
  caption?: string;
};

type MultiSelectProps<T extends string> = {
  value: readonly T[];
  options: readonly MultiSelectOption<T>[];
  onChange: (value: T[]) => void;
  /** Label for the shortcut chip that selects every option at once. */
  selectAllLabel?: string;
  /** Rendered above the grid, e.g. "3 of 6 municipalities". */
  summary?: string;
};

/**
 * Multi-select chip grid with a leading "All" shortcut. Selecting the shortcut
 * checks every option; tapping it again clears the selection, so it doubles as
 * a deselect-all affordance.
 */
export function MultiSelect<T extends string>({
  value,
  options,
  onChange,
  selectAllLabel = 'All',
  summary,
}: MultiSelectProps<T>) {
  const selected = new Set(value);
  const allSelected = options.length > 0 && options.every((o) => selected.has(o.value));

  return (
    <View style={styles.wrap}>
      {summary ? <Text style={styles.summary}>{summary}</Text> : null}

      <View style={styles.grid}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: allSelected }}
          accessibilityLabel={selectAllLabel}
          onPress={() => onChange(allSelected ? [] : options.map((o) => o.value))}
          style={({ pressed }) => [
            styles.chip,
            allSelected && styles.chipSelected,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.label, allSelected && styles.labelSelected]} numberOfLines={1}>
            {selectAllLabel}
          </Text>
        </Pressable>

        {options.map((opt) => {
          const active = selected.has(opt.value);
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={opt.label}
              onPress={() => {
                const next = new Set(selected);
                if (next.has(opt.value)) next.delete(opt.value);
                else next.add(opt.value);
                onChange(options.filter((o) => next.has(o.value)).map((o) => o.value));
              }}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.label, active && styles.labelSelected]} numberOfLines={1}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {options.some((o) => o.caption) ? (
        <View style={styles.legend}>
          <AppIcon name="info" size={14} color={colors.faint} />
          <Text style={styles.legendText}>{options.find((o) => o.caption)?.caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  summary: { ...typography.label, color: colors.primaryDeep },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    height: 40,
    justifyContent: 'center',
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
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendText: { ...typography.caption, flex: 1, color: colors.faint },
});
