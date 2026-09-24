import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signInWithEmail, useAuth } from '@isla/supabase';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { TextField } from '../../ui/TextField';
import { colors, spacing, typography } from '../../ui/theme';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { client } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }
    setSubmitting(true);
    const { error } = await signInWithEmail(client, { email, password });
    setSubmitting(false);
    if (error) {
      Alert.alert('Login failed', error);
    }
  };

  return (
    <Screen>
      <Text style={typography.title}>Welcome back</Text>
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
        placeholder="••••••••"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title="Log in" onPress={() => void handleLogin()} loading={submitting} />
      <Pressable style={styles.link} onPress={() => navigation.navigate('Otp')}>
        <Text style={styles.linkText}>Use an email code instead</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { alignItems: 'center', marginTop: spacing.sm },
  linkText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
});