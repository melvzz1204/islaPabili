import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  AppIcon,
  Button,
  Screen,
  ScreenHeader,
  SheetModal,
  colors,
  spacing,
  typography,
} from '@isla/ui';
import { AuthIntro, SocialAuth } from '../../components/SocialAuth';
import { LoginForm } from '../../components/auth/LoginForm';
import { RolePicker } from '../../components/RolePicker';
import { useAuthMode } from '../../lib/authMode';
import type { RootNavProp } from '../../navigation/types';

/**
 * Sign-in landing. Clear hierarchy, no scroll on a normal phone:
 *   1. brand hero (logo + name + tagline)
 *   2. "continue as" role selector
 *   3. primary Log in (bottom-sheet form) / secondary Create account (screen)
 *   4. social providers behind a divider
 *   5. terms footnote
 */
export default function AuthHomeScreen() {
  const navigation = useNavigation<RootNavProp>();
  const { mode, setMode } = useAuthMode();
  const canGoBack = navigation.canGoBack();
  const [loginOpen, setLoginOpen] = useState(false);
  const closeLogin = () => setLoginOpen(false);
  const goRegister = () => {
    setLoginOpen(false);
    navigation.navigate('Register');
  };

  return (
    <Screen background={colors.primaryTint}>
      <ScreenHeader title="" onBack={canGoBack ? () => navigation.goBack() : undefined} />

      <AuthIntro tagline="Pabili at delivery sa buong Marinduque, isang tap lang." />

      <RolePicker value={mode} onChange={setMode} />

      <View style={styles.actions}>
        <Button
          title="Log in"
          icon={<AppIcon name="user" size={18} color={colors.onPrimary} />}
          onPress={() => setLoginOpen(true)}
        />
        <Button
          title="Create an account"
          variant="outline"
          icon={<AppIcon name="add" size={18} color={colors.primary} />}
          onPress={() => navigation.navigate('Register')}
        />
      </View>

      <SocialAuth />

      <Text style={styles.terms}>
        Sa pagpapatuloy, sumasang-ayon ka sa aming Terms at Privacy Policy.
      </Text>

      <SheetModal
        visible={loginOpen}
        title="Welcome back"
        subtitle="Mag-login para magpatuloy sa IslaPabili."
        onClose={closeLogin}
        avoidKeyboard
      >
        <LoginForm onSuccess={closeLogin} onSwitchToRegister={goRegister} />
      </SheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.xs },
  terms: { ...typography.caption, color: colors.faint, textAlign: 'center', marginTop: spacing.sm },
});

