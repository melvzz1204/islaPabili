import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppIcon } from '../icons';
import { colors, radius, spacing, typography } from '../tokens';

type SearchBarProps = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  /** Overrides the placeholder as the accessible name. */
  accessibilityLabel?: string;
  /** Rendered at the trailing edge (e.g. a filter action). */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Pill search field, the most-used control across the marketplace. */
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  onFocus,
  accessibilityLabel,
  trailing,
  style,
}: SearchBarProps) {
  const hasValue = value.length > 0;
  return (
    <View style={[styles.wrap, style]}>
      <AppIcon name="search" size={19} color={colors.faint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        onFocus={onFocus}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        style={styles.input}
      />
      {hasValue ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={10}
          style={styles.clear}
        >
          <AppIcon name="close" size={12} color={colors.onPrimary} />
        </Pressable>
      ) : null}
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.base,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  input: {
    flex: 1,
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  clear: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
