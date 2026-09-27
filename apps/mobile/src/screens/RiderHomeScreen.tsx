import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { isAllTowns, isNoTowns, resolveOptedTowns, TOWN_LABELS, type Town } from '@isla/shared';
import { signOut, useAuth } from '@isla/supabase';
import type { Database } from '@isla/supabase';
import { AppIcon, Badge, Button, Card, Screen, colors, spacing, typography } from '@isla/ui';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import type { RootNavProp } from '../navigation/types';
import { backToShopping } from '../navigation/types';

type RiderStatusRow = Database['public']['Tables']['rider_status']['Row'];

export default function RiderHomeScreen() {
  const { client, profile } = useAuth();
  const navigation = useNavigation<RootNavProp>();
  const [onDuty, setOnDuty] = useState(false);
  const [statusRow, setStatusRow] = useState<RiderStatusRow | null>(null);
  const [toggling, setToggling] = useState(false);

  // Prefer the recorded operating area; fall back to the customer's opted-in
  // towns so a rider who has not applied yet still shows something sensible.
  const operatingTowns = useMemo<Town[]>(() => {
    if (statusRow && !isNoTowns(statusRow.operating_towns)) return [...statusRow.operating_towns];
    return resolveOptedTowns(profile);
  }, [statusRow, profile]);

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
      // Physical position, which is one town at a time.
      current_town: profile.home_town ?? null,
      // The area the rider is approved and willing to deliver in.
      operating_towns: operatingTowns,
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

  const areaLabel = isAllTowns(operatingTowns)
    ? 'All municipalities'
    : isNoTowns(operatingTowns)
      ? 'No operating area set'
      : operatingTowns.map((t) => TOWN_LABELS[t]).join(', ');

  return (
    <Screen footer={<BottomNav />} footerHeight={BOTTOM_NAV_HEIGHT}>
      <View style={styles.header}>
        <Text style={typography.display}>Rider Dashboard</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {profile?.full_name ?? 'Rider'}
        </Text>
      </View>

      <Card>
        <View style={styles.areaRow}>
          <AppIcon name="pin" size={20} color={colors.primary} />
          <View style={styles.areaText}>
            <Text style={styles.areaLabel}>Operating area</Text>
            <Text style={styles.areaValue}>{areaLabel}</Text>
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.dutyRow}>
          <View style={styles.dutyText}>
            <Badge label={onDuty ? 'On duty' : 'Off duty'} status={onDuty ? 'delivered' : 'neutral'} />
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
            thumbColor={onDuty ? colors.primary : colors.faint}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.earningsRow}>
          <AppIcon name="wallet" size={28} color={colors.success} />
          <Text style={typography.heading}>Today's earnings</Text>
        </View>
        <Text style={styles.earnings}>₱0.00</Text>
        <Text style={styles.cardBody}>
          Trip tracking and payouts land in Milestone 5.
        </Text>
      </Card>

      <Button
        title="Switch to shopping"
        variant="secondary"
        onPress={() => backToShopping(navigation)}
      />
      <Button
        title="Log out"
        variant="ghost"
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
  subtitle: { ...typography.label },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  areaText: { flex: 1, gap: 2 },
  areaLabel: { ...typography.caption },
  areaValue: { ...typography.subhead, fontWeight: '700' },
  dutyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  dutyText: { flex: 1, gap: spacing.xs, alignItems: 'flex-start' },
  dutyLabel: { ...typography.subhead, fontSize: 17, fontWeight: '700' },
  dutyHint: { ...typography.caption },
  earningsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  earnings: { ...typography.display, color: colors.success },
  cardBody: { ...typography.caption },
  meta: { ...typography.caption, textAlign: 'center' },
});
