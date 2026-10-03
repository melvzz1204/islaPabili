import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Screen, ScreenHeader, colors, radius, shadows, spacing } from '@isla/ui';
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

      <RolePicker value={mode} onChange={setMode} />
      <SocialAuth />

      <View style={styles.ctaCard}>
        <Button title="Log in" style={styles.pill} onPress={() => navigation.navigate('Login')} />
        <Button title="Create an account" variant="secondary" onPress={() => navigation.navigate('Register')} />
        <Button title="Continue with phone" variant="ghost" onPress={() => navigation.navigate('Phone')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
