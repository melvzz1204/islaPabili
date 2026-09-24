import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { isValidPhPhone, normalizePhPhone } from '@isla/shared';
import { sendPhoneOtp, useAuth, verifyPhoneOtp } from '@isla/supabase';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { TextField } from '../../ui/TextField';
import { colors, spacing, typography } from '../../ui/theme';

export default function PhoneScreen() {
  const { client } = useAuth();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [phoneInput, setPhoneInput] = useState('');
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sendCode = async () => {
    const phone = normalizePhPhone(phoneInput);
    if (!phone) {
      Alert.alert('Invalid number', 'Enter a valid PH mobile number, e.g. 0917 123 4567.');
      return;
    }
    setSubmitting(true);
    const { error } = await sendPhoneOtp(client, phone);
    setSubmitting(false);
    if (error) {
      Alert.alert(
        'Could not send code',
        `${error}\n\nMake sure SMS is on in Supabase Dashboard > Auth > Phone (an SMS provider like Twilio is required to deliver codes).`,
      );
      return;
    }
    setStep('verify');
  };

  const handleVerify = async () => {
    const phone = normalizePhPhone(phoneInput);
    if (!phone) {
      Alert.alert('Invalid number', 'Please re-enter your number.');
      return;
    }
    if (!token) {
      Alert.alert('Code required', 'Enter the 6-digit code sent to your phone.');
      return;
    }
    setSubmitting(true);
    const { error } = await verifyPhoneOtp(client, { phone, token });
    setSubmitting(false);
    if (error) {
      Alert.alert('Invalid code', error);
    }
  };

  return (
    <Screen>
      <Text style={typography.title}>Phone login</Text>
      <Text style={styles.hint}>
        {step === 'request'
          ? "We'll text you a one-time code you can use to log in."
          : `Enter the code we texted to ${normalizePhPhone(phoneInput) ?? phoneInput}.`}
      </Text>
      <TextField
        label="Mobile number"
        placeholder="09XX XXX XXXX"
        keyboardType="phone-pad"
        value={phoneInput}
        onChangeText={setPhoneInput}
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
        onPress={step === 'request' ? () => void sendCode() : () => void handleVerify()}
        loading={submitting}
      />
      {step === 'verify' ? (
        <Button
          title="Resend code"
          variant="secondary"
          disabled={submitting}
          onPress={() => void sendCode()}
        />
      ) : null}
      <Pressable
        style={styles.link}
        onPress={() => {
          setStep('request');
          setToken('');
        }}
        accessibilityRole="button"
      >
        <Text style={styles.linkText}>Use a different number</Text>
      </Pressable>
      {!isValidPhPhone(phoneInput) && phoneInput.length > 0 ? (
        <Text style={styles.error}>Enter a valid PH mobile number, e.g. 0917 123 4567.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, color: colors.muted },
  link: { alignItems: 'center', marginTop: spacing.sm },
  linkText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center' },
});