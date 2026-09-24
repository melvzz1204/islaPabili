import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuth, signInWithProvider, exchangeOAuthCode } from '@isla/supabase';
import { Button } from '../ui/Button';
import { colors, spacing, typography } from '../ui/theme';

WebBrowser.maybeCompleteAuthSession();

const PROVIDER_LABELS: Record<'google' | 'facebook', string> = {
  google: 'Google',
  facebook: 'Facebook',
};

export function SocialAuth() {
  const { client } = useAuth();
  const [pending, setPending] = useState<'google' | 'facebook' | null>(null);

  const handleProvider = async (provider: 'google' | 'facebook') => {
    if (pending) return;
    const redirectTo = Linking.createURL('auth');
    try {
      setPending(provider);
      const { url, error } = await signInWithProvider(client, provider, redirectTo);
      if (error) {
        Alert.alert(
          `${PROVIDER_LABELS[provider]} not ready`,
          `${error}\n\nTurn it on in Supabase Dashboard > Auth > Providers > ${PROVIDER_LABELS[provider]}.`,
        );
        return;
      }
      if (!url) {
        Alert.alert('Could not start login', 'No authorization URL was returned.');
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
      if (result.type !== 'success' || !result.url) {
        if (result.type === 'dismiss') {
          // user backed out; nothing to do
        }
        return;
      }
      const exchange = await exchangeOAuthCode(client, result.url);
      if (exchange.error) {
        Alert.alert('Login failed', exchange.error);
      }
    } catch (err) {
      Alert.alert('Login failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={styles.stack}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            title="Continue with Google"
            variant="secondary"
            loading={pending === 'google'}
            onPress={() => void handleProvider('google')}
          />
        </View>
        <View style={styles.flex}>
          <Button
            title="Continue with Facebook"
            variant="secondary"
            loading={pending === 'facebook'}
            onPress={() => void handleProvider('facebook')}
          />
        </View>
      </View>
      <Text style={styles.or}>or</Text>
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
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  intro: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl + 16, marginBottom: spacing.lg },
  tagline: { ...typography.caption, textAlign: 'center' },
  muted: { color: colors.muted },
  or: { ...typography.caption, color: colors.muted, textAlign: 'center' },
});