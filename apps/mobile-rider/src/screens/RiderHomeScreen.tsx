import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { TOWN_LABELS } from '@isla/shared';
import { signOut, useAuth } from '@isla/supabase';
import type { Database } from '@isla/supabase';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { colors, spacing, typography } from '../ui/theme';

type RiderStatusRow = Database['public']['Tables']['rider_status']['Row'];

export default function RiderHomeScreen() {
  const { client, profile } = useAuth();
  const [onDuty, setOnDuty] = useState(false);
  const [statusRow, setStatusRow] = useState<RiderStatusRow | null>(null);
  const [toggling, setToggling] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await client
      .from('rider_status')
      .select('*')
      .eq('rider_id', profile.id)
      .maybeSingle();
    if (error) return;
    setStatusRow(data);
    setOnDuty(data?.on_duty ?? false);
  }, [client, profile]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const toggleDuty = async (next: boolean) => {
    if (!profile) return;
    setToggling(true);
    const { error } = await client.from('rider_status').upsert({
      rider_id: profile.id,
      on_duty: next,
      current_town: profile.home_town ?? null,
    });
    setToggling(false);
    if (error) {
      Alert.alert('Could not update duty status', error.message);
      return;
    }
    setOnDuty(next);
    setStatusRow((prev) => (prev ? { ...prev, on_duty: next } : prev));
  };

  const handleLogout = async () => {
    await signOut(client);
  };

  const townLabel = profile?.home_town ? TOWN_LABELS[profile.home_town] : '—';

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.title}>Rider Dashboard</Text>
        <Text style={styles.subtitle}>
          {townLabel} · {profile?.full_name ?? 'Rider'}
        </Text>
      </View>

      <View style={styles.dutyCard}>
        <View style={styles.dutyText}>
          <Text style={styles.dutyLabel}>{onDuty ? 'On duty — accepting pabili' : 'Off duty'}</Text>
          <Text style={styles.dutyHint}>
            {onDuty
              ? 'Matchmaking and dispatch arrive in Milestone 4.'
              : 'Flip the switch when you are ready to work.'}
          </Text>
        </View>
        <Switch
          value={onDuty}
          onValueChange={(v) => void Alert.alert(
            v ? 'Go on duty' : 'Go off duty',
            v
              ? 'You will be visible to incoming pabili requests once dispatch is live.'
              : 'You will stop receiving pabili requests.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: v ? 'Go on duty' : 'Go off duty', onPress: () => void toggleDuty(v) },
            ],
          )}
          disabled={toggling}
          trackColor={{ false: colors.border, true: colors.primarySoft }}
          thumbColor={onDuty ? colors.primary : colors.muted}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today's earnings</Text>
        <Text style={styles.earnings}>₱0.00</Text>
        <Text style={styles.cardBody}>
          Trip tracking and payouts land in Milestone 5.
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
      {statusRow == null ? (
        <Text style={styles.meta}>No duty status on record yet.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  subtitle: { ...typography.caption, color: colors.muted },
  dutyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  dutyText: { flex: 1, gap: spacing.xs },
  dutyLabel: { fontSize: 17, fontWeight: '700', color: colors.text },
  dutyHint: { ...typography.caption },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, gap: spacing.sm },
  cardTitle: { ...typography.heading, fontSize: 16 },
  earnings: { ...typography.title, color: colors.primary },
  cardBody: { ...typography.caption },
  meta: { textAlign: 'center', fontSize: 12, color: colors.muted },
});