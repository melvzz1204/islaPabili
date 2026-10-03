import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppIcon, Screen, colors, radius, shadows, spacing, typography } from '@isla/ui';
import { HowItWorks } from '../components/HowItWorks';
import type { RootNavProp, TabScreen } from '../navigation/types';

type Props = TabScreen<'Shop'>;

/**
 * Guest landing: mirrors the Figma prototype (Login/Register top-right,
 * "How it works?" timeline, big Create Pabili List CTA). No stores listed.
 */
export default function LandingScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();

  return (
    <Screen edges={['top']}>
      <View style={styles.topRow}>
        <View style={styles.spacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Login or register"
          onPress={() => navigation.navigate('AuthHome')}
          style={({ pressed }) => [styles.loginPill, pressed && styles.pressed]}
        >
          <AppIcon name="user" size={16} color={colors.primaryDeep} />
          <Text style={styles.loginLabel}>Login/Register</Text>
        </Pressable>
      </View>

      <HowItWorks onCreate={() => navigation.navigate('PabiliCreate')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  spacer: { flex: 1 },
  loginPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 46,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    ...shadows.card,
  },
  loginLabel: { ...typography.label, fontWeight: '700', color: colors.primaryDeep },
  pressed: { opacity: 0.7 },
});
