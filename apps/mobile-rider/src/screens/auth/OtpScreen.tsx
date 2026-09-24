import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { sendEmailOtp, useAuth, verifyEmailOtp } from '@isla/supabase';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { TextField } from '../../ui/TextField';
import { colors, spacing, typography } from '../../ui/theme';

export default function OtpScreen() {
  const { client } = useAuth();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRequest = async () => {
    if (!email) {
      Alert.alert('Email required', 'Enter the email address to receive your code.');
      return;
    }
    setSubmitting(true);
    const { error } = await sendEmailOtp(client, email);
    setSubmitting(false);
    if (error) {
      Alert.alert('Could not send code', error);
      return;
    }
    setStep('verify');
  };

  const handleVerify = async () => {
    if (!token) {
      Alert.alert('Code required', 'Enter the 6-digit code sent to your email.');
      return;
    }
    setSubmitting(true);
    const { error } = await verifyEmailOtp(client, { email, token });
    setSubmitting(false);
    if (error) {
      Alert.alert('Invalid code', error);
    }
  };

  return (
    <Screen>
      <Text style={typography.title}>Email code login</Text>
      <Text style={styles.hint}>
        {step === 'request'
          ? "We'll send you a one-time code you can use to log in."
          : `Enter the code we sent to ${email}.`}
      </Text>
      <TextField
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={step === 'request'}
      />
      {step === 'verify' ? (
        <TextField
          label="6-digit code"
          placeholder="123456"
          keyboardType="number-pad"
          value={token}
          onChangeText={setToken}
        />
      ) : null}
      <Button
        title={step === 'request' ? 'Send code' : 'Log in'}
        onPress={step === 'request' ? () => void handleRequest() : () => void handleVerify()}
        loading={submitting}
      />
      {step === 'verify' ? (
        <Button
          title="Resend code"
          variant="secondary"
          disabled={submitting}
          onPress={() => void handleRequest()}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, marginBottom: spacing.xs, color: colors.muted },
});