import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Screen, ScreenHeader, colors, radius, shadows, spacing, typography } from '@isla/ui';
import { AuthIntro, SocialAuth } from '../../components/SocialAuth';
import { RolePicker } from '../../components/RolePicker';
import { useAuthMode } from '../../lib/authMode';
import type { RootNavProp } from '../../navigation/types';

export default function AuthHomeScreen() {
  const navigation = useNavigation<RootNavProp>();
  const { mode, setMode } = useAuthMode();
  const canGoBack = navigation.canGoBack();
  return (
    <Screen background={colors.primaryTint}>
      <ScreenHeader
        title="Sign in"
        onBack={canGoBack ? () => navigation.goBack() : undefined}
      />

      <AuthIntro />

      <View style={styles.headline}>
        <Text style={styles.title}>
          {mode === 'rider' ? 'Deliver and earn' : 'Order anything, delivered'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'rider'
            ? 'Sign in with your rider account to start accepting deliveries.'
            : 'Sign in to order food and pabili from stores across Marinduque.'}
        </Text>
      </View>

      <RolePicker value={mode} onChange={setMode} />
      <SocialAuth />

      <View style={styles.ctaCard}>
        <Button title="Log in" style={styles.pill} onPress={() => navigation.navigate('Login')} />
        <Button title="Create an account" variant="secondary" onPress={() => navigation.navigate('Register')} />
        <Button title="Continue with phone" variant="ghost" onPress={() => navigation.navigate('Phone')} />
      </View>

      <Text style={styles.footnote}>
        One IslaPabili account works for both ordering and delivering.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headline: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  title: { ...typography.title, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.muted, textAlign: 'center' },
  ctaCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.card,
  },
  pill: { borderRadius: radius.pill },
  footnote: { ...typography.caption, textAlign: 'center' },
});
