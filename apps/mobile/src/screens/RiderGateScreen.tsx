import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { signOut, useAuth, type Database } from '@isla/supabase';
import { Button, SheetModal, colors, spacing, useToast } from '@isla/ui';
import RiderApplicationScreen from './RiderApplicationScreen';
import RiderStatusScreen from './RiderStatusScreen';
import RiderHomeScreen from './RiderHomeScreen';
import type { RootNavProp, RootStackScreen } from '../navigation/types';

type RiderApplicationRow = Database['public']['Tables']['rider_applications']['Row'];
type Props = RootStackScreen<'Rider'>;

/**
 * Rider shell gate: no application → apply; pending/rejected → status;
 * approved → rider dashboard. Standalone — customer tabs don't exist here,
 * so leaving the shell always means logging out.
 */
export default function RiderGateScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { client, profile } = useAuth();
  const { showToast } = useToast();
  const [application, setApplication] = useState<RiderApplicationRow | 'loading' | 'none'>('loading');
  const [logoutOpen, setLogoutOpen] = useState(false);
  // Standalone rider stack has no back stack; from customer notifications it does.
  const canGoBack = navigation.canGoBack();

  const handleLogout = () => {
    setLogoutOpen(false);
    void signOut(client).catch(() => {
      showToast({ message: 'Could not sign out. Please try again.', type: 'error' });
    });
  };

  const exitRow = (
    <View style={styles.exit}>
      {canGoBack ? (
        <Button title="Back" variant="secondary" onPress={() => navigation.goBack()} />
      ) : null}
      <Button title="Log out" variant="ghost" onPress={() => setLogoutOpen(true)} />
    </View>
  );

  const logoutModal = (
    <SheetModal
      visible={logoutOpen}
      title="Log out of rider mode?"
      subtitle="Customer mode needs a fresh login."
      onClose={() => setLogoutOpen(false)}
      footer={
        <View style={styles.exit}>
          <Button title="Cancel" variant="secondary" onPress={() => setLogoutOpen(false)} />
          <Button title="Log out" variant="danger" onPress={handleLogout} />
        </View>
      }
    >
      <></>
    </SheetModal>
  );

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
        {exitRow}
        {logoutModal}
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
      {exitRow}
      {logoutModal}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  exit: { gap: spacing.sm, padding: spacing.lg, paddingTop: 0, backgroundColor: colors.bg },
});
