import { useNavigation } from '@react-navigation/native';
import { AuthHeader, Screen, ScreenHeader, colors } from '@isla/ui';
import { RegisterForm } from '../../components/auth/RegisterForm';
import { RolePicker } from '../../components/RolePicker';
import { useAuthMode } from '../../lib/authMode';
import type { RootNavProp } from '../../navigation/types';

export default function RegisterScreen() {
  const navigation = useNavigation<RootNavProp>();
  const { mode, setMode } = useAuthMode();

  return (
    <Screen background={colors.primaryTint}>
      <ScreenHeader title="" onBack={() => navigation.goBack()} />

      <AuthHeader
        icon="pabili"
        accent
        align="center"
        title="Create your account"
        subtitle="A minute to sign up, you'll pick your town in the next step."
      />

      <RolePicker value={mode} onChange={setMode} />

      <RegisterForm onSwitchToLogin={() => navigation.navigate('Login')} />
    </Screen>
  );
}
