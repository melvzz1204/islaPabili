import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth, type Database } from '@isla/supabase';
import { Button, colors, spacing, useToast } from '@isla/ui';
import RiderApplicationScreen from './RiderApplicationScreen';
import RiderStatusScreen from './RiderStatusScreen';
import RiderHomeScreen from './RiderHomeScreen';
import { BottomNav } from '../components/BottomNav';
import type { RootNavProp, RootStackScreen } from '../navigation/types';
import { backToShopping } from '../navigation/types';

type RiderApplicationRow = Database['public']['Tables']['rider_applications']['Row'];
type Props = RootStackScreen<'Rider'>;

/**
 * Rider mode gate (single-app): no application → apply; pending/rejected →
 * status; approved → duty dashboard. Same account as the customer side.
 */
export default function RiderGateScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { client, profile } = useAuth();
  const { showToast } = useToast();
  const [application, setApplication] = useState<RiderApplicationRow | 'loading' | 'none'>('loading');

  const loadApplication = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await client
      .from('rider_applications')
      .select('*')
      .eq('rider_id', profile.id)
      .maybeSingle();
    if (error || !data) {
      setApplication('none');
      return;
    }
    setApplication(data);
  }, [client, profile]);

  useEffect(() => {
    void loadApplication();
  }, [loadApplication]);

  if (application === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (application === 'none') {
    return (
      <View style={styles.flex}>
        <RiderApplicationScreen
          onSubmitted={() => {
            showToast({
              message: 'Application submitted — watch the notification bell for the review result.',
              type: 'success',
            });
            void loadApplication();
          }}
        />
      </View>
    );
  }

  if (application.status === 'approved') {
    return (
      <View style={styles.flex}>
        <RiderHomeScreen />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <RiderStatusScreen application={application} onRefresh={() => void loadApplication()} />
      <View style={styles.back}>
        <Button
          title="Back to shopping"
          variant="secondary"
          onPress={() => backToShopping(navigation)}
        />
      </View>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  back: { padding: spacing.lg, backgroundColor: colors.bg },
});
