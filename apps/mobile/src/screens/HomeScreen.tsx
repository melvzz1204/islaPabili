import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { isAllTowns, resolveOptedTowns, TOWN_LABELS } from '@isla/shared';
import { useAuth, type Database } from '@isla/supabase';
import { AppIcon, Card, IconButton, Screen, colors, spacing, typography } from '@isla/ui';
import { peso } from '../marketplace/data';
import { CACHE_TTLS, cacheKey, fetchWithCache } from '../lib/cache';
import { HowItWorks } from '../components/HowItWorks';
import { useUnreadCount } from './NotificationsScreen';
import { useUnreadMessages } from '../messaging/chat';
import type { RootNavProp, TabScreen } from '../navigation/types';

type Props = TabScreen<'Home'>;
type OrderRow = Database['public']['Tables']['orders']['Row'];
type ActiveStatus = Database['public']['Enums']['order_status'];

const ACTIVE_STATUSES: ActiveStatus[] = [
  'awaiting_merchant',
  'preparing',
  'ready',
  'pending_dispatch',
  'rider_assigned',
  'items_purchased',
  'in_transit',
];

/** Merchant-wait means placed, no merchant counter yet, the rider shops. */
const ACTIVE_LABEL: Partial<Record<ActiveStatus, string>> = {
  awaiting_merchant: 'order placed',
};

export default function HomeScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { client, profile } = useAuth();
  const unread = useUnreadCount();
  const unreadMessages = useUnreadMessages('customer');
  const [activeOrder, setActiveOrder] = useState<OrderRow | null>(null);

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  // Show the opt-in set, not just the delivery town ("All municipalities" when
  // the customer took every town, otherwise the first pick).
  const optedTowns = useMemo(() => resolveOptedTowns(profile), [profile]);
  const townLabel = isAllTowns(optedTowns)
    ? 'All municipalities'
    : optedTowns.length > 0
      ? TOWN_LABELS[optedTowns[0]]
      : 'Marinduque';

  useEffect(() => {
    if (!profile) return;
    let active = true;
    const orderKey = cacheKey('orders', 'active', profile.id);

    const loadOrder = async (force = false) => {
      try {
        const rows = await fetchWithCache<OrderRow[]>(
          orderKey,
          async () => {
            const { data } = await client
              .from('orders')
              .select('*')
              .eq('customer_id', profile.id)
              .in('status', ACTIVE_STATUSES)
              .order('created_at', { ascending: false })
              .limit(1);
            return (data ?? []) as OrderRow[];
          },
          { ttlMs: CACHE_TTLS.orders, persist: true, force },
        );
        if (active) setActiveOrder(rows[0] ?? null);
      } catch {
        // Offline: keep whatever active order (if any) is already on screen.
      }
    };

    void loadOrder();
    const channel = client
      .channel(`home-orders-${profile.id}-${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${profile.id}` },
        () => void loadOrder(true),
      )
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [client, profile]);

  return (
    <Screen>
      {/* Greeting */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>Kamusta,</Text>
          <Text style={styles.name} numberOfLines={1}>
            {firstName}!
          </Text>
          <View style={styles.locationRow}>
            <AppIcon name="pin" size={13} color={colors.faint} />
            <Text style={styles.location} numberOfLines={1}>
              {townLabel}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            icon="message"
            label={unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'Messages'}
            onPress={() => navigation.navigate('Messages')}
            tone="soft"
            badge={unreadMessages}
          />
          <IconButton
            icon="bell"
            label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            onPress={() => navigation.navigate('Notifications')}
            tone="soft"
            badge={unread}
          />
        </View>
      </View>

      {/* Active order tracking */}
      {activeOrder ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Active order, ${ACTIVE_LABEL[activeOrder.status] ?? activeOrder.status.replace(/_/g, ' ')}`}
          onPress={() => navigation.navigate('Orders')}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Card variant="tinted" style={styles.activeCard}>
            <View style={styles.activeIcon}>
              <AppIcon name="rider" size={20} color={colors.primaryDeep} />
            </View>
            <View style={styles.activeText}>
              <Text style={styles.activeTitle}>Order in progress</Text>
              <Text style={styles.activeBody}>
                {ACTIVE_LABEL[activeOrder.status] ?? activeOrder.status.replace(/_/g, ' ')} ·{' '}
                {peso(Number(activeOrder.grand_total ?? 0))}
              </Text>
            </View>
            <AppIcon name="chevronRight" size={18} color={colors.primaryDeep} />
          </Card>
        </Pressable>
      ) : null}

      {/* Prototype landing content: how-it-works timeline + big CTA. */}
      <HowItWorks onCreate={() => navigation.navigate('PabiliCreate')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: { flex: 1, gap: 1 },
  greeting: { ...typography.body, color: colors.muted },
  name: { ...typography.display, fontSize: 27 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  location: { ...typography.caption },
  headerActions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs },

  activeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  activeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeText: { flex: 1, gap: 1 },
  activeTitle: { ...typography.label, color: colors.primaryDeep },
  activeBody: { ...typography.caption, color: colors.primaryDeep, textTransform: 'capitalize' },

  pressed: { opacity: 0.7 },
});
