import { useNavigation } from '@react-navigation/native';
import { Button, Screen, ScreenHeader } from '@isla/ui';
import { AuthIntro, SocialAuth } from '../../components/SocialAuth';
import { RolePicker } from '../../components/RolePicker';
import { useAuthMode } from '../../lib/authMode';
import type { RootNavProp } from '../../navigation/types';

export default function AuthHomeScreen() {
  const navigation = useNavigation<RootNavProp>();
  const { mode, setMode } = useAuthMode();
  return (
    <Screen>
      <ScreenHeader
        title="Sign in"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <AuthIntro />
      <RolePicker value={mode} onChange={setMode} />
      <SocialAuth />

      <Button title="Log in" onPress={() => navigation.navigate('Login')} />
      <Button title="Create an account" variant="secondary" onPress={() => navigation.navigate('Register')} />
      <Button title="Continue with phone" variant="ghost" onPress={() => navigation.navigate('Phone')} />
    </Screen>
  );
}
