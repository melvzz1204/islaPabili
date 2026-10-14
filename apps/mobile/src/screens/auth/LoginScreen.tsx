import { useNavigation } from '@react-navigation/native';
import { AuthHeader, Screen, ScreenHeader, colors } from '@isla/ui';
import { LoginForm } from '../../components/auth/LoginForm';
import { RolePicker } from '../../components/RolePicker';
import { useAuthMode } from '../../lib/authMode';
import type { RootNavProp } from '../../navigation/types';

export default function LoginScreen() {
  const navigation = useNavigation<RootNavProp>();
  const { mode, setMode } = useAuthMode();

  return (
    <Screen background={colors.primaryTint}>
      <ScreenHeader title="" onBack={() => navigation.goBack()} />

      <AuthHeader
        icon="user"
        align="center"
        title="Welcome back"
        subtitle="Mag-order pabili anywhere in Marinduque."
      />

      <RolePicker value={mode} onChange={setMode} />

      <LoginForm
        onSwitchToRegister={() => navigation.navigate('Register')}
        onBackToOptions={() => navigation.navigate('AuthHome')}
      />
    </Screen>
  );
}
