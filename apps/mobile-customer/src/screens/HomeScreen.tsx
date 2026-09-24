import { Alert, StyleSheet, Text, View } from 'react-native';
import { TOWN_LABELS } from '@isla/shared';
import { signOut, useAuth } from '@isla/supabase';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { colors, spacing, typography } from '../ui/theme';

export default function HomeScreen() {
  const { client, profile } = useAuth();

  const handleLogout = async () => {
    await signOut(client);
  };

  const townLabel = profile?.home_town ? TOWN_LABELS[profile.home_town] : '—';

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.title}>Hello, {profile?.full_name?.split(' ')[0] ?? 'there'}!</Text>
        <Text style={styles.subtitle}>
          {townLabel} · {profile?.phone ?? 'no phone set'}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Order a Pabili</Text>
        <Text style={styles.cardBody}>
          Merchant catalog and custom shopping lists arrive in Milestone 3. Coming soon.
        </Text>
      </View>
      <Button
        title="Log out"
        variant="secondary"
        onPress={() => void Alert.alert('Log out', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log out', style: 'destructive', onPress: () => void handleLogout() },
        ])}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  subtitle: { ...typography.caption, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { ...typography.heading },
  cardBody: { ...typography.body, color: colors.muted },
});