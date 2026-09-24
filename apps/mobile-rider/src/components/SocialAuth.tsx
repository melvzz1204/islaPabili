import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth, signInWithProvider } from '@isla/supabase';
import * as Linking from 'expo-linking';
import { Button } from '../ui/Button';
import { typography } from '../ui/theme';

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
      <Text style={typography.title}>IslaPabili Rider</Text>
      <Text style={styles.tagline}>Ipabili, kuhain, ihatid. Kumita sa Marinduque.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  intro: { alignItems: 'center', gap: 8, marginTop: 48, marginBottom: 24 },
  tagline: { ...typography.caption, textAlign: 'center', color: '#6B7280' },
});