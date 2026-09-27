import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../tokens';

type CheckboxProps = {
  checked: boolean;
  onToggle: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/** Standalone checkbox. Composable — pair with any label/link content. */
export function Checkbox({ checked, onToggle, label, style }: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label ?? 'Checkbox'}
      onPress={onToggle}
      style={[styles.box, checked && styles.boxChecked, style]}
    >
      {checked ? <Text style={styles.check}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  boxChecked: { backgroundColor: colors.primary },
  check: { color: colors.onPrimary, fontWeight: '700', fontSize: 15, lineHeight: 18 },
});
