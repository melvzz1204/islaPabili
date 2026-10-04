import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { signOut, useAuth, type Database } from '@isla/supabase';
import { Button, SheetModal, colors, spacing, useToast } from '@isla/ui';
import MerchantApplicationScreen from './MerchantApplicationScreen';
import MerchantStatusScreen from './MerchantStatusScreen';
import MerchantHomeScreen from './MerchantHomeScreen';
import type { RootNavProp, RootStackScreen } from '../navigation/types';

type MerchantApplicationRow = Database['public']['Tables']['merchant_applications']['Row'];

type Props = RootStackScreen<'Merchant'>;

type GateState =
  | { kind: 'loading' }
  | { kind: 'home'; merchantId: string }
  | { kind: 'apply' }
  | { kind: 'status'; application: MerchantApplicationRow };

/**
 * Merchant shell gate: owns a store → dashboard; application
 * pending/rejected → status; none → register the store.
 * Leaving the shell always means logging out.
 */
export default function MerchantGateScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { client, profile } = useAuth();
  const { showToast } = useToast();
  const [state, setState] = useState<GateState>({ kind: 'loading' });
  const [logoutOpen, setLogoutOpen] = useState(false);
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
      title="Log out of merchant mode?"
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

  const load = useCallback(async () => {
    if (!profile) return;
    setState({ kind: 'loading' });
    const [{ data: ownership }, { data: application }] = await Promise.all([
      client.from('merchant_owners').select('merchant_id').eq('profile_id', profile.id).limit(1),
      client.from('merchant_applications').select('*').eq('applicant_id', profile.id).maybeSingle(),
    ]);
    const merchantId = ownership?.[0]?.merchant_id ?? null;
    if (merchantId) {
      setState({ kind: 'home', merchantId });
      return;
    }
    if (!application) {
      setState({ kind: 'apply' });
      return;
    }
    setState({ kind: 'status', application });
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (state.kind === 'home') {
    return (
      <View style={styles.flex}>
        <MerchantHomeScreen merchantId={state.merchantId} />
      </View>
    );
  }

  if (state.kind === 'apply') {
    return (
      <View style={styles.flex}>
        <MerchantApplicationScreen
          onSubmitted={() => {
            showToast({
              message: 'Application submitted, watch the notification bell for the review result.',
              type: 'success',
            });
            void load();
          }}
        />
        {exitRow}
        {logoutModal}
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <MerchantStatusScreen application={state.application} onRefresh={() => void load()} />
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
