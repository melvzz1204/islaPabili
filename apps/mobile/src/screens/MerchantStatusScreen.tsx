import { StyleSheet, Text, View } from 'react-native';
import type { Database } from '@isla/supabase';
import { AuthHeader, Badge, Button, Screen, colors, typography } from '@isla/ui';

type MerchantApplicationRow = Database['public']['Tables']['merchant_applications']['Row'];

type Props = {
  application: MerchantApplicationRow;
  onRefresh: () => void;
};

export default function MerchantStatusScreen({ application, onRefresh }: Props) {
  const rejected = application.status === 'rejected';
  return (
    <Screen>
      <AuthHeader
        icon="storefront"
        title={rejected ? 'Application not approved' : 'Application under review'}
        subtitle={
          rejected
            ? 'Your store application was not approved. Contact support to ask why.'
            : `“${application.store_name}” is being verified by an IslaPabili administrator. Your store goes live once approved.`
        }
      />
      <View style={styles.row}>
        <Badge label={rejected ? 'Rejected' : 'Pending review'} status={rejected ? 'danger' : 'warning'} />
      </View>
      <Button title="Check status again" variant="secondary" onPress={onRefresh} />
      <Text style={styles.ref}>Reference: {application.id.slice(0, 8)}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-start' },
  ref: { ...typography.caption, color: colors.faint, textAlign: 'center' },
});
