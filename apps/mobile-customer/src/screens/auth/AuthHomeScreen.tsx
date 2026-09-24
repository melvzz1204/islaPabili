import { Pressable, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { colors, spacing } from '../../ui/theme';
import { AuthIntro, SocialAuth } from '../../components/SocialAuth';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'AuthHome'>;

export default function AuthHomeScreen({ navigation }: Props) {
  return (
    <Screen>
      <AuthIntro />
      <SocialAuth />
      <Button title="Log in" onPress={() => navigation.navigate('Login')} />
      <Button
        title="Create an account"
        variant="secondary"
        onPress={() => navigation.navigate('Register')}
      />
      <Button
        title="Continue with phone"
        variant="secondary"
        onPress={() => navigation.navigate('Phone')}
      />
      <Pressable
        style={styles.otpLink}
        onPress={() => navigation.navigate('Otp')}
        accessibilityRole="button"
      >
        <Text style={styles.otpText}>Log in with an email code instead</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  otpLink: { alignItems: 'center', marginTop: spacing.sm },
  otpText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
});