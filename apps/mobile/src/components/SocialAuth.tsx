import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuth, signInWithProvider, exchangeOAuthCode } from '@isla/supabase';
import {
  AppIcon,
  Button,
  OrDivider,
  colors,
  spacing,
  taglines,
  typography,
} from '@isla/ui';
import { BrandLogo } from './BrandLogo';

WebBrowser.maybeCompleteAuthSession();

const PROVIDERS = [
  { id: 'google' as const, label: 'Google' },
  { id: 'facebook' as const, label: 'Facebook' },
];

export function SocialAuth() {
  const { client } = useAuth();
  const [pending, setPending] = useState<'google' | 'facebook' | null>(null);

  const handleProvider = async (provider: 'google' | 'facebook') => {
    if (pending) return;
    const redirectTo = Linking.createURL('auth');
    if (__DEV__) console.log('[OAuth] redirectTo:', redirectTo);
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
      if (result.type !== 'success' || !result.url) return;
      const exchange = await exchangeOAuthCode(client, result.url);
      if (exchange.error) Alert.alert('Login failed', exchange.error);
    } catch (err) {
      Alert.alert('Login failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={styles.stack}>
      <View style={styles.row}>
        {PROVIDERS.map((p) => (
          <View key={p.id} style={styles.flex}>
            <Button
              title={p.label}
              variant="secondary"
              loading={pending === p.id}
              icon={pending === p.id ? undefined : <AppIcon name={p.id} size={20} />}
              onPress={() => void handleProvider(p.id)}
            />
          </View>
        ))}
      </View>
      <OrDivider label="or" />
    </View>
  );
}

const PROVIDER_LABELS: Record<'google' | 'facebook', string> = {
  google: 'Google',
  facebook: 'Facebook',
};

/** Brand lockup shown on the sign-in landing screen. */
export function AuthIntro() {
  return (
    <View style={styles.intro}>
      <BrandLogo width={212} />
      <View style={styles.introText}>
        <Text style={styles.tagline}>{taglines.primary}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },

  intro: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xxl, marginBottom: spacing.sm },
  introText: { alignItems: 'center', gap: spacing.xs },
  tagline: { ...typography.body, color: colors.muted, textAlign: 'center' },
});
