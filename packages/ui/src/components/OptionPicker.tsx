import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '../icons';
import { colors, radius, spacing, typography } from '../tokens';
import { SheetModal } from './SheetModal';

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
 * `list` renders inline chips; `field` renders a tappable field that opens
 * a bottom-sheet dropdown with every option.
 */
export function OptionPicker<T extends string>({
  value,
  options,
  onChange,
  variant = 'list',
  placeholder = 'Select an option',
}: OptionPickerProps<T>) {
  if (variant === 'field') {
    return <FieldPicker value={value} options={options} onChange={onChange} placeholder={placeholder} />;
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

function FieldPicker<T extends string>({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: T | null;
  options: readonly { value: T; label: string; caption?: string }[];
  onChange: (value: T) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const active = selected != null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selected ? selected.label : placeholder}
        accessibilityHint="Opens a list of options"
        onPress={() => setOpen(true)}
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
      <SheetModal
        visible={open}
        title={placeholder}
        subtitle={`${options.length} options`}
        onClose={() => setOpen(false)}
      >
        {options.map((opt) => {
          const isCurrent = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: isCurrent }}
              onPress={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              style={({ pressed }) => [styles.optionRow, isCurrent && styles.optionRowActive, pressed && styles.pressed]}
            >
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, isCurrent && styles.optionLabelActive]}>{opt.label}</Text>
                {opt.caption ? <Text style={styles.fieldCaption}>{opt.caption}</Text> : null}
              </View>
              {isCurrent ? <AppIcon name="check" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </SheetModal>
    </>
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionRowActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  optionText: { flex: 1, gap: 1 },
  optionLabel: { ...typography.body, color: colors.body },
  optionLabelActive: { color: colors.primaryDeep, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
