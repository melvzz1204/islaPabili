import { StyleSheet, Text, View } from 'react-native';
import { TOWN_LABELS } from '@isla/shared';
import { useAuth } from '@isla/supabase';
import type { Database } from '@isla/supabase';
import { Button } from '../ui/Button';
import { colors, spacing, typography } from '../ui/theme';

type RiderApplicationRow = Database['public']['Tables']['rider_applications']['Row'];

type Props = {
  application: RiderApplicationRow;
  onRefresh: () => void;
};

const STATUS_COPY = {
  pending: {
    title: 'Application under review',
    body: 'An IslaPabili administrator is verifying your documents. This usually takes 1–2 business days. You will be able to go on duty once approved.',
    color: colors.warn,
  },
  rejected: {
    title: 'Application not approved',
    body: 'Your application was not approved. Contact support to ask why or re-apply.',
    color: colors.danger,
  },
} as const;

export default function RiderStatusScreen({ application, onRefresh }: Props) {
  const { profile } = useAuth();
  const status = application.status === 'rejected' ? 'rejected' : 'pending';
  const copy = STATUS_COPY[status];
  const townLabel = profile?.home_town ? TOWN_LABELS[profile.home_town] : '—';

  return (
    <View style={styles.center}>
      <View style={styles.card}>
        <View style={[styles.badge, { backgroundColor: copy.color }]}>
          <Text style={styles.badgeText}>{status === 'pending' ? 'PENDING' : 'REJECTED'}</Text>
        </View>
        <Text style={typography.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
        <Text style={styles.detail}>Operating town: {townLabel}</Text>
        <Button title="Check status again" variant="secondary" onPress={onRefresh} />
        <Text style={styles.meta}>Reference #: {application.id.slice(0, 8)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, gap: spacing.md },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  body: { ...typography.body, color: colors.muted },
  detail: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { textAlign: 'center', fontSize: 12, color: colors.muted },
});