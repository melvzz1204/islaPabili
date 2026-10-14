import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { resendSignupEmail, signInWithPassword, useAuth } from '@isla/supabase';
import {
  Button,
  OrDivider,
  PasswordField,
  TextField,
  TextLink,
  colors,
  radius,
  useToast,
} from '@isla/ui';
import { formatCooldown, useResendCooldown } from '../../lib/useResendCooldown';
import { useAuthMode } from '../../lib/authMode';

type Props = {
  /** Called after a successful sign-in (close a sheet; no-op on the full screen). */
  onSuccess?: () => void;
  /** Switch to the create-account flow. */
  onSwitchToRegister?: () => void;
  /** Optional trailing link back to all sign-in options (standalone screen). */
  onBackToOptions?: () => void;
};

/** Sign-in form body. Shared by the full Login screen and the landing sheet. */
export function LoginForm({ onSuccess, onSwitchToRegister, onBackToOptions }: Props) {
  const { client } = useAuth();
  const { showToast } = useToast();
  const { mode } = useAuthMode();
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
    showToast({
      message: mode === 'rider' ? 'Welcome back, rider!' : 'Welcome back!',
      type: 'success',
    });
    onSuccess?.();
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
    <>
      <TextField
        label="Username or email"
        placeholder="juan_dela_cruz or you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        value={login}
        onChangeText={setLogin}
        fieldStyle={styles.field}
      />
      <PasswordField
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        autoComplete="current-password"
        fieldStyle={styles.field}
      />

      <Button title="Log in" style={styles.pill} onPress={() => void handleLogin()} loading={submitting} />

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

      {onSwitchToRegister ? (
        <>
          <OrDivider label="New to IslaPabili?" />
          <Button title="Create an account" variant="secondary" onPress={onSwitchToRegister} />
        </>
      ) : null}

      {onBackToOptions ? (
        <TextLink label="Back to all sign-in options" onPress={onBackToOptions} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: colors.surfaceSunken,
    borderColor: 'transparent',
    borderRadius: radius.pill,
  },
  pill: { borderRadius: radius.pill },
});
