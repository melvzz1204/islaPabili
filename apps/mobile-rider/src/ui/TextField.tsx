import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radius, spacing } from './theme';

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
};

export function TextField({ label, error, style, ...props }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? styles.inputError : undefined, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, width: '100%' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  error: { fontSize: 13, color: colors.danger },
});