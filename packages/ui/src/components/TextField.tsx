import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, layout, radius, spacing, typography } from '../tokens';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  error?: string | null;
  hint?: string;
  leftAccessory?: ReactNode;
  rightAccessory?: ReactNode;
  /** Removes the floating label for dense forms. */
  compact?: boolean;
  containerStyle?: TextInputProps['style'];
  /** Overrides the outer field box (e.g. soft-fill pill inputs on tinted auth screens). */
  fieldStyle?: StyleProp<ViewStyle>;
};

export function TextField({
  label,
  error,
  hint,
  leftAccessory,
  rightAccessory,
  compact = false,
  containerStyle,
  fieldStyle,
  ...props
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasAccessory = leftAccessory != null || rightAccessory != null;

  return (
    <View style={styles.wrap}>
      {label && !compact ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          fieldStyle,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
          hasAccessory && styles.fieldAccessory,
        ]}
      >
        {leftAccessory}
        <TextInput
          placeholderTextColor={colors.faint}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[styles.input, containerStyle]}
          {...props}
        />
        {rightAccessory}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, width: '100%' },
  label: { ...typography.label, color: colors.body },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.controlHeight,
    paddingHorizontal: spacing.base,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  fieldAccessory: { paddingLeft: spacing.md },
  fieldFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  fieldError: { borderColor: colors.danger },
  input: {
    flex: 1,
    fontFamily: typography.body.fontFamily,
    fontSize: 15.5,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  error: { ...typography.caption, color: colors.danger },
  hint: { ...typography.caption },
});
