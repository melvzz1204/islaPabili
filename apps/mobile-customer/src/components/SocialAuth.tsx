import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth, signInWithProvider } from '@isla/supabase';
import * as Linking from 'expo-linking';
import { Button } from '../ui/Button';
import { colors, spacing, typography } from '../ui/theme';

export function SocialAuth() {
  const { client } = useAuth();

  const handleProvider = async (provider: 'google' | 'facebook') => {
    const { error } = await signInWithProvider(client, provider, Linking.createURL('auth'));
    if (error) {
      Alert.alert(
        'Provider not ready',
        `${error}\n\nEnable "${provider === 'google' ? 'Google' : 'Facebook'}" in Supabase Dashboard > Auth > Providers to use this.`,
      );
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Button title="Google" variant="secondary" onPress={() => void handleProvider('google')} />
      </View>
      <View style={styles.flex}>
        <Button title="Facebook" variant="secondary" onPress={() => void handleProvider('facebook')} />
      </View>
    </View>
  );
}

export function AuthIntro() {
  return (
    <View style={styles.intro}>
      <Text style={typography.title}>IslaPabili</Text>
      <Text style={styles.tagline}>Pabili & doorstep delivery sa buong Marinduque</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  intro: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl + 16, marginBottom: spacing.lg },
  tagline: { ...typography.caption, textAlign: 'center' },
  muted: { color: colors.muted },
});