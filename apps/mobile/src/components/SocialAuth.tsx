import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuth, signInWithProvider, exchangeOAuthCode } from '@isla/supabase';
import {
  AppIcon,
  OrDivider,
  colors,
  radius,
  spacing,
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
      <OrDivider label="or continue with" />
      <View style={styles.row}>
        {PROVIDERS.map((p) => {
          const loading = pending === p.id;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`Continue with ${p.label}`}
              accessibilityState={{ busy: loading, disabled: pending != null }}
              onPress={() => void handleProvider(p.id)}
              disabled={pending != null}
              style={({ pressed }) => [
                styles.circle,
                pressed && pending == null && styles.pressed,
                pending != null && !loading && styles.dim,
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <AppIcon name={p.id} size={24} />
              )}
            </Pressable>
          );
        })}
      </View>
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
      <BrandLogo width={132} />
      <Text style={styles.wordmark}>Isla Pabili</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.lg, justifyContent: 'center' },
  circle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6, transform: [{ scale: 0.94 }] },
  dim: { opacity: 0.45 },

  intro: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xxl, marginBottom: spacing.sm },
  wordmark: { ...typography.title, fontSize: 28, color: colors.ink, textAlign: 'center' },
});
