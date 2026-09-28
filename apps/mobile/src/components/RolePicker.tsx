import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon, Badge, colors, radius, spacing, typography, useToast, type AppIconName } from '@isla/ui';
import type { AuthMode } from '../lib/authMode';

type RoleOption = {
  value: AuthMode | 'merchant';
  label: string;
  hint: string;
  icon: AppIconName;
  disabled?: boolean;
};

const OPTIONS: RoleOption[] = [
  { value: 'customer', label: 'Customer', hint: 'Order food & pabili', icon: 'user' },
  { value: 'rider', label: 'Rider', hint: 'Deliver and earn', icon: 'rider' },
  { value: 'merchant', label: 'Merchant store', hint: 'Sell on IslaPabili', icon: 'storefront', disabled: true },
];

type Props = {
  value: AuthMode;
  onChange: (mode: AuthMode) => void;
};

/**
 * "Continue as…" selector shared by the auth screens. Merchant stores are
 * still onboarding, so that option renders grayed out with a Soon badge.
 */
export function RolePicker({ value, onChange }: Props) {
  const { showToast } = useToast();
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Continue as">
      <Text style={styles.heading}>I want to continue as</Text>
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled: opt.disabled }}
            accessibilityLabel={`${opt.label}, ${opt.hint}${opt.disabled ? ', coming soon' : ''}`}
            onPress={() => {
              if (opt.disabled) {
                showToast({ message: 'Merchant stores are still onboarding.', type: 'info' });
                return;
              }
              onChange(opt.value as AuthMode);
            }}
            style={({ pressed }) => [
              styles.card,
              selected && styles.cardActive,
              opt.disabled && styles.cardDisabled,
              pressed && !opt.disabled && styles.pressed,
            ]}
          >
            <View style={[styles.icon, selected && styles.iconActive, opt.disabled && styles.iconDisabled]}>
              <AppIcon name={opt.icon} size={20} color={selected ? colors.primaryDeep : colors.muted} />
            </View>
            <View style={styles.text}>
              <Text style={[styles.label, selected && styles.labelActive, opt.disabled && styles.labelDisabled]}>
                {opt.label}
              </Text>
              <Text style={styles.hint}>{opt.hint}</Text>
            </View>
            {opt.disabled ? (
              <Badge label="Soon" status="neutral" />
            ) : (
              <View style={[styles.radio, selected && styles.radioActive]}>
                {selected ? <View style={styles.dot} /> : null}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  heading: { ...typography.label, fontWeight: '700' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.hairline,
  },
  cardActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  cardDisabled: { opacity: 0.45, backgroundColor: colors.surfaceSunken },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: { backgroundColor: colors.surface },
  iconDisabled: { backgroundColor: colors.surface },
  text: { flex: 1, gap: 1 },
  label: { ...typography.subhead, fontWeight: '700' },
  labelActive: { color: colors.primaryDeep },
  labelDisabled: { color: colors.faint },
  hint: { ...typography.caption },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  dot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
  pressed: { opacity: 0.7 },
});
