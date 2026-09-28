import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { isValidPhPhone, normalizePhPhone } from '@isla/shared';
import { sendPhoneOtp, useAuth, verifyPhoneOtp } from '@isla/supabase';
import { Button, Screen, ScreenHeader, TextField, TextLink, colors, typography } from '@isla/ui';
import { RolePicker } from '../../components/RolePicker';
import { useAuthMode } from '../../lib/authMode';

export default function PhoneScreen() {
  const { client } = useAuth();
  const navigation = useNavigation<{ goBack: () => void }>();
  const { mode, setMode } = useAuthMode();
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
    if (error) Alert.alert('Invalid code', error);
  };

  const normalized = normalizePhPhone(phoneInput);
  const numberError = !isValidPhPhone(phoneInput) && phoneInput.length > 0
    ? 'Enter a valid PH mobile number, e.g. 0917 123 4567.'
    : null;

  return (
    <Screen>
      <ScreenHeader title="Continue with phone" onBack={() => navigation.goBack()} />

      <RolePicker value={mode} onChange={setMode} />

      <Text style={styles.note}>
        {mode === 'rider'
          ? 'Riders sign in here, then apply or head straight to the rider dashboard.'
          : 'Customers sign in here to order and track pabili.'}
      </Text>

      <TextField
        label="Mobile number"
        placeholder="09XX XXX XXXX"
        keyboardType="phone-pad"
        value={phoneInput}
        onChangeText={setPhoneInput}
        editable={step === 'request'}
        error={numberError}
        hint={
          step === 'request'
            ? "We'll text you a one-time code you can use to log in."
            : `Enter the code we texted to ${normalized ?? phoneInput}.`
        }
      />

      {step === 'verify' ? (
        <TextField
          label="6-digit code"
          placeholder="123456"
          keyboardType="number-pad"
          value={token}
          onChangeText={setToken}
          autoFocus
        />
      ) : null}

      <Button
        title={step === 'request' ? 'Send code' : 'Log in'}
        onPress={step === 'request' ? () => void sendCode() : () => void handleVerify()}
        loading={submitting}
      />

      {step === 'verify' ? (
        <>
          <Button
            title="Resend code"
            variant="secondary"
            disabled={submitting}
            onPress={() => void sendCode()}
          />
          <TextLink
            label="Use a different number"
            onPress={() => {
              setStep('request');
              setToken('');
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { ...typography.caption, color: colors.muted },
});
