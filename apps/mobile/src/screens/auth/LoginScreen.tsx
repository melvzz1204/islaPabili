import { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { resendSignupEmail, signInWithPassword, useAuth } from '@isla/supabase';
import {
  AuthHeader,
  Button,
  OrDivider,
  PasswordField,
  Screen,
  ScreenHeader,
  TextField,
  TextLink,
  useToast,
} from '@isla/ui';
import { formatCooldown, useResendCooldown } from '../../lib/useResendCooldown';
import type { RootNavProp } from '../../navigation/types';

export default function LoginScreen() {
  const { client } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation<RootNavProp>();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const { cooldown, coolingDown, start: startCooldown } = useResendCooldown();

  const handleLogin = async () => {
    if (!login.trim() || !password) {
      showToast({ message: 'Enter your username or email and password.', type: 'error' });
      return;
    }
    setSubmitting(true);
    const { error } = await signInWithPassword(client, { login, password });
    setSubmitting(false);
    if (error) {
      setNeedsConfirmation(/confirm/i.test(error));
      Alert.alert('Login failed', error);
      return;
    }
    showToast({ message: 'Welcome back!', type: 'success' });
  };

  const handleResendConfirmation = async () => {
    setSubmitting(true);
    const { error } = await resendSignupEmail(client, login.trim());
    setSubmitting(false);
    if (error) {
      Alert.alert('Could not resend email', error);
      return;
    }
    startCooldown();
    showToast({ message: 'Confirmation email sent. Check your inbox.', type: 'success' });
  };

  const canResend = needsConfirmation && login.includes('@');

  return (
    <Screen>
      <ScreenHeader title="" onBack={() => navigation.goBack()} />

      <AuthHeader
        icon="user"
        title="Welcome back"
        subtitle="Mag-order pabili anywhere in Marinduque."
      />

      <TextField
        label="Username or email"
        placeholder="juan_dela_cruz or you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        value={login}
        onChangeText={setLogin}
      />
      <PasswordField
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        autoComplete="current-password"
      />

      <Button title="Log in" onPress={() => void handleLogin()} loading={submitting} />

      {canResend ? (
        <Button
          title={
            coolingDown
              ? `Resend confirmation email in ${formatCooldown(cooldown)}`
              : 'Resend confirmation email'
          }
          variant="soft"
          disabled={submitting || coolingDown}
          onPress={() => void handleResendConfirmation()}
        />
      ) : null}

      <OrDivider label="New to IslaPabili?" />

      <Button
        title="Create an account"
        variant="secondary"
        onPress={() => navigation.navigate('Register')}
      />
      <Button
        title="Continue with phone"
        variant="ghost"
        onPress={() => navigation.navigate('Phone')}
      />

      <TextLink label="Back to all sign-in options" onPress={() => navigation.navigate('AuthHome')} />
    </Screen>
  );
}
