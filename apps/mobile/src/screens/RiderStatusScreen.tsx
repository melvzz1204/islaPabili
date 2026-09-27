import { StyleSheet, Text, View } from 'react-native';
import { isAllTowns, isNoTowns, TOWN_LABELS } from '@isla/shared';
import type { Database } from '@isla/supabase';
import { Badge, Button, Card, colors, spacing, typography } from '@isla/ui';

type RiderApplicationRow = Database['public']['Tables']['rider_applications']['Row'];

type Props = {
  application: RiderApplicationRow;
  onRefresh: () => void;
};

const STATUS_COPY = {
  pending: {
    title: 'Application under review',
    body: 'An IslaPabili administrator is verifying your documents. This usually takes 1–2 business days. You will be able to go on duty once approved. Watch the notification bell — you will be notified here the moment it is decided.',
  },
  rejected: {
    title: 'Application not approved',
    body: 'Your application was not approved. Contact support to ask why or re-apply.',
  },
} as const;

export default function RiderStatusScreen({ application, onRefresh }: Props) {
  const status = application.status === 'rejected' ? 'rejected' : 'pending';
  const copy = STATUS_COPY[status];

  // Operating area comes from the application, not home_town, so a rider can
  // see exactly what they applied for.
  const towns = application.operating_towns;
  const areaLabel = isAllTowns(towns)
    ? 'All municipalities'
    : isNoTowns(towns)
      ? '—'
      : towns.map((t) => TOWN_LABELS[t]).join(', ');

  return (
    <View style={styles.center}>
      <Card style={styles.card}>
        <Badge label={status === 'pending' ? 'PENDING' : 'REJECTED'} status={status === 'pending' ? 'pending' : 'cancelled'} />
        <Text style={typography.display}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
        <View style={styles.areaRow}>
          <Text style={styles.detail}>Operating area:</Text>
          <Text style={styles.areaValue}>{areaLabel}</Text>
        </View>
        <Button title="Check status again" variant="secondary" onPress={onRefresh} />
        <Text style={styles.meta}>Reference #: {application.id.slice(0, 8)}</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  card: { gap: spacing.lg, alignItems: 'flex-start' },
  body: { ...typography.body, color: colors.muted },
  areaRow: { gap: 2 },
  detail: { ...typography.caption },
  areaValue: { ...typography.subhead, fontWeight: '600' },
  meta: { ...typography.caption, textAlign: 'center', alignSelf: 'center' },
});
