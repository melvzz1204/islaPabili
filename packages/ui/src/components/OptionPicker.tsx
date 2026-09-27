import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '../icons';
import { colors, radius, spacing, typography } from '../tokens';

type OptionPickerProps<T extends string> = {
  value: T | null;
  options: readonly { value: T; label: string; caption?: string }[];
  onChange: (value: T) => void;
  /** `list` for inline chips, `sheet` for a tappable field that opens a sheet. */
  variant?: 'list' | 'field';
  placeholder?: string;
};

/**
 * Select-one control used for towns and similar short enums.
 * `list` renders inline chips; `field` renders a single tappable row.
 */
export function OptionPicker<T extends string>({
  value,
  options,
  onChange,
  variant = 'list',
  placeholder = 'Select an option',
}: OptionPickerProps<T>) {
  if (variant === 'field') {
    const selected = options.find((o) => o.value === value);
    const active = selected != null;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selected ? selected.label : placeholder}
        accessibilityHint="Opens a list of options"
        onPress={() => {
          const first = options[0];
          if (first) onChange(first.value);
        }}
        style={({ pressed }) => [styles.field, active && styles.fieldActive, pressed && styles.pressed]}
      >
        <View style={styles.fieldText}>
          <Text style={[styles.fieldLabel, active && styles.fieldLabelActive]}>
            {selected ? selected.label : placeholder}
          </Text>
          {selected?.caption ? <Text style={styles.fieldCaption}>{selected.caption}</Text> : null}
        </View>
        <AppIcon name="chevronDown" size={18} color={active ? colors.primary : colors.faint} />
      </Pressable>
    );
  }

  return (
    <View style={styles.list}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipLabel: { ...typography.label, color: colors.body },
  chipLabelActive: { color: colors.onPrimary },

  fieldText: { flex: 1, gap: 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.base,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  fieldActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  fieldLabel: { ...typography.body, color: colors.faint },
  fieldLabelActive: { color: colors.text, fontWeight: '600' },
  fieldCaption: { ...typography.caption },
  pressed: { opacity: 0.7 },
});
