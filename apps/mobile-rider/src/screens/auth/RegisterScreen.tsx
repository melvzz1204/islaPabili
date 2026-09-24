import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { signUpWithEmail, useAuth } from '@isla/supabase';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { TextField } from '../../ui/TextField';
import { colors, spacing, typography } from '../../ui/theme';

export default function RegisterScreen() {
  const { client } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    if (fullName.trim().length < 2) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Please re-enter your password.');
      return;
    }
    setSubmitting(true);
    const { error } = await signUpWithEmail(client, { email, password, fullName: fullName.trim() });
    setSubmitting(false);
    if (error) {
      Alert.alert('Sign up failed', error);
    }
  };

  return (
    <Screen>
      <Text style={typography.title}>Become a rider</Text>
      <Text style={styles.hint}>
        Create your account, then submit your application and compliance documents for review.
      </Text>
      <TextField label="Full name" placeholder="Juan Dela Cruz" value={fullName} onChangeText={setFullName} />
      <TextField
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Password"
        placeholder="At least 8 characters"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextField
        label="Confirm password"
        placeholder="Repeat your password"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />
      <Button title="Create rider account" onPress={() => void handleRegister()} loading={submitting} />
      <Text style={styles.finePrint}>
        Your documents are verified by IslaPabili before you can go on duty.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, color: colors.muted, marginBottom: spacing.xs },
  finePrint: { ...typography.caption, textAlign: 'center', color: colors.muted },
});