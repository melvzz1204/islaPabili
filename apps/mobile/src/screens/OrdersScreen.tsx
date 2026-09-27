import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth, type Database } from '@isla/supabase';
import {
  AppIcon,
  Badge,
  Button,
  Card,
  EmptyState,
  Screen,
  SegmentedTabs,
  SheetModal,
  Skeleton,
  Timeline,
  colors,
  radius,
  spacing,
  typography,
  useToast,
  type TimelineStep,
} from '@isla/ui';
import { peso } from '../marketplace/data';
import { callRpc } from '../lib/rpc';
import type { RootNavProp, TabScreen } from '../navigation/types';

type Props = TabScreen<'Orders'>;
type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type StatusLog = Database['public']['Tables']['order_status_log']['Row'];
type OrderStatus = Database['public']['Enums']['order_status'];

type StatusMeta = { label: string; badge: 'pending' | 'transit' | 'delivered' | 'cancelled' | 'neutral' };

const STATUS_META: Record<OrderStatus, StatusMeta> = {
  awaiting_merchant: { label: 'Waiting for store', badge: 'pending' },
  preparing: { label: 'Being prepared', badge: 'transit' },
  ready: { label: 'Ready for pickup', badge: 'transit' },
  declined: { label: 'Store is busy', badge: 'cancelled' },
  pending_dispatch: { label: 'Finding a rider', badge: 'pending' },
  rider_assigned: { label: 'Rider assigned', badge: 'transit' },
  items_purchased: { label: 'Items purchased', badge: 'transit' },
  in_transit: { label: 'On the way', badge: 'transit' },
  completed: { label: 'Delivered', badge: 'delivered' },
  cancelled: { label: 'Cancelled', badge: 'cancelled' },
  failed: { label: 'Failed', badge: 'cancelled' },
};

const metaOf = (s: string): StatusMeta =>
  STATUS_META[s as OrderStatus] ?? { label: s.replace(/_/g, ' '), badge: 'neutral' };

const ACTIVE_STATUSES: OrderStatus[] = [
  'awaiting_merchant',
  'preparing',
  'ready',
  'pending_dispatch',
  'rider_assigned',
  'items_purchased',
  'in_transit',
];

/** Canonical happy path, used to render the progress timeline. */
const FLOW: OrderStatus[] = [
  'awaiting_merchant',
  'preparing',
  'ready',
  'items_purchased',
  'in_transit',
  'completed',
];

const FULFILLMENT_LABEL: Record<string, string> = {
  merchant_pickup: 'Self-pickup',
  rider_pabili: 'Rider pabili',
  rider_delivery: 'Rider delivery',
};

type Scope = 'active' | 'past';

export default function OrdersScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { client, profile } = useAuth();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>('active');
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [logs, setLogs] = useState<StatusLog[]>([]);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await client
      .from('orders')
      .select('*')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (!error) setOrders(data ?? []);
    setLoading(false);
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!profile) return;
    const channel = client
      .channel(`orders-customer-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${profile.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, profile, load]);

  const { active, past } = useMemo(() => {
    const a: OrderRow[] = [];
    const p: OrderRow[] = [];
    for (const o of orders) {
      if (ACTIVE_STATUSES.includes(o.status)) a.push(o);
      else p.push(o);
    }
    return { active: a, past: p };
  }, [orders]);

  const visible = scope === 'active' ? active : past;

  const openDetail = async (order: OrderRow) => {
    setSelected(order);
    setItems([]);
    setLogs([]);
    const [{ data: itemRows }, { data: logRows }] = await Promise.all([
      client.from('order_items').select('*').eq('order_id', order.id),
      client
        .from('order_status_log')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true }),
    ]);
    setItems(itemRows ?? []);
    setLogs(logRows ?? []);
  };

  /** Re-offer a waiting pabili list to whoever is on duty right now. */
  const retryDispatch = async (order: OrderRow) => {
    setActing(true);
    const { data: offered, error } = await callRpc<number>(client, 'request_pabili_riders', {
      p_order_id: order.id,
    });
    setActing(false);
    if (error) {
      showToast({ message: error.message, type: 'error' });
      return;
    }
    showToast({
      message:
        (offered ?? 0) > 0
          ? `Looking again — ${offered} rider${offered === 1 ? '' : 's'} on duty notified.`
          : 'No riders on duty right now. Please retry again later.',
      type: (offered ?? 0) > 0 ? 'success' : 'error',
    });
    await load();
  };

  const transition = async (order: OrderRow, patch: Partial<OrderRow>, done: string) => {
    setActing(true);
    const { error } = await client.from('orders').update(patch).eq('id', order.id);
    setActing(false);
    if (error) {
      showToast({ message: error.message, type: 'error' });
      return;
    }
    showToast({ message: done, type: 'success' });
    setSelected(null);
    await load();
  };

  const timelineSteps = useMemo<TimelineStep[]>(() => {
    if (!selected) return [];
    if (selected.status === 'declined' || selected.status === 'cancelled' || selected.status === 'failed') {
      return [
        { label: 'Order placed', caption: new Date(selected.created_at).toLocaleString(), state: 'done' },
        {
          label: metaOf(selected.status).label,
          caption: logs.length ? new Date(logs[logs.length - 1]!.created_at).toLocaleString() : undefined,
          state: 'failed',
        },
      ];
    }
    const reached = new Set(logs.map((l) => l.status));
    const currentIdx = FLOW.indexOf(selected.status);
    return FLOW.map((status, i) => {
      const log = logs.find((l) => l.status === status);
      const state: TimelineStep['state'] =
        selected.status === status
          ? 'current'
          : i < currentIdx || (currentIdx === -1 && reached.has(status))
            ? 'done'
            : 'upcoming';
      return {
        label: metaOf(status).label,
        caption: log ? new Date(log.created_at).toLocaleString() : undefined,
        state,
      };
    });
  }, [selected, logs]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>
          {loading ? 'Loading…' : `${active.length} active · ${past.length} completed`}
        </Text>
      </View>

      <SegmentedTabs
        segments={[
          { value: 'active', label: 'Active', badge: active.length },
          { value: 'past', label: 'Past' },
        ]}
        value={scope}
        onChange={setScope}
      />

      {loading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={44} height={44} borderRadius={radius.md} />
              <View style={styles.skeletonBody}>
                <Skeleton width="50%" height={15} />
                <Skeleton width="80%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : visible.length === 0 ? (
        <EmptyState
          title={scope === 'active' ? 'No active orders' : 'No past orders'}
          message={
            scope === 'active'
              ? 'When you place a pabili, you can follow it here from store to doorstep.'
              : 'Completed and cancelled orders will be listed here.'
          }
          icon="orders"
          action={
            scope === 'active' ? (
              <Button
                title="Start shopping"
                onPress={() => navigation.navigate('Shop')}
              />
            ) : undefined
          }
        />
      ) : (
        <View style={styles.list}>
          {visible.map((o) => (
            <OrderRowCard key={o.id} order={o} onPress={() => void openDetail(o)} />
          ))}
        </View>
      )}

      <SheetModal
        visible={selected !== null}
        title={selected ? `Order ${selected.order_number}` : ''}
        subtitle={selected ? metaOf(selected.status).label : undefined}
        onClose={() => setSelected(null)}
        footer={
          selected ? (
            <View style={styles.sheetFoot}>
              {selected.status === 'declined' ? (
                <>
                  <Button
                    title="Let a rider shop for me"
                    loading={acting}
                    onPress={() =>
                      void transition(
                        selected,
                        { status: 'pending_dispatch', fulfillment_mode: 'rider_pabili' },
                        'Switched to rider pabili.',
                      )
                    }
                  />
                  <Button
                    title="Cancel order"
                    variant="danger"
                    disabled={acting}
                    onPress={() => void transition(selected, { status: 'cancelled' }, 'Order cancelled.')}
                  />
                </>
              ) : selected.status === 'awaiting_merchant' || selected.status === 'preparing' ? (
                <Button
                  title="Cancel order"
                  variant="danger"
                  loading={acting}
                  onPress={() => void transition(selected, { status: 'cancelled' }, 'Order cancelled.')}
                />
              ) : selected.is_custom_list && selected.status === 'pending_dispatch' ? (
                <>
                  <Button
                    title="Retry finding rider"
                    loading={acting}
                    onPress={() => void retryDispatch(selected)}
                  />
                  <Button
                    title="Cancel pabili request"
                    variant="danger"
                    disabled={acting}
                    onPress={() => void transition(selected, { status: 'cancelled' }, 'Pabili request cancelled.')}
                  />
                </>
              ) : null}
              <Button title="Close" variant="secondary" onPress={() => setSelected(null)} />
            </View>
          ) : undefined
        }
      >
        {selected ? (
          <View style={styles.sheetBody}>
            {selected.fulfillment_mode === 'merchant_pickup' && selected.status === 'ready' ? (
              <Card variant="tinted" style={styles.pickupCard} padded={false}>
                <Text style={styles.pickupHint}>Show this number at the counter</Text>
                <Text style={styles.pickupNo}>{selected.order_number}</Text>
              </Card>
            ) : null}

            <View style={styles.sheetTotalRow}>
              <Text style={styles.muted}>
                {FULFILLMENT_LABEL[selected.fulfillment_mode] ?? selected.fulfillment_mode}
              </Text>
              <Text style={styles.sheetTotal}>{peso(Number(selected.grand_total))}</Text>
            </View>

            <Text style={styles.sectionTitle}>Items</Text>
            {items.length === 0 ? (
              <Text style={styles.muted}>No items recorded yet.</Text>
            ) : (
              items.map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <Text style={styles.itemQty}>{it.quantity}×</Text>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {it.name}
                  </Text>
                  <Text style={styles.itemValue}>
                    {it.estimated_price != null ? peso(Number(it.estimated_price) * it.quantity) : ''}
                  </Text>
                </View>
              ))
            )}

            {selected.is_custom_list && selected.status === 'pending_dispatch' ? (
              <Text style={styles.muted}>
                {Date.now() - new Date(selected.created_at).getTime() > 5 * 60 * 1000
                  ? 'Still looking — the last 5-minute offer round lapsed with no takers. Hit “Retry finding rider” below.'
                  : 'Live now — on-duty riders in your town are being notified. First to accept wins.'}
              </Text>
            ) : null}

            <Text style={styles.sectionTitle}>Progress</Text>            {timelineSteps.length === 0 ? (
              <Text style={styles.muted}>Status updates will appear here.</Text>
            ) : (
              <Timeline steps={timelineSteps} />
            )}
          </View>
        ) : null}
      </SheetModal>
    </Screen>
  );
}

type OrderRowCardProps = { order: OrderRow; onPress: () => void };

function OrderRowCard({ order, onPress }: OrderRowCardProps) {
  const meta = metaOf(order.status);
  return (
    <Card variant="flat" style={styles.orderCard} onPress={onPress} padded={false}>
      <View style={styles.orderInner}>
        <View style={styles.orderIcon}>
          <AppIcon name="pabili" size={22} color={colors.primaryDeep} />
        </View>
        <View style={styles.orderBody}>
          <Text style={styles.orderNo}>{order.order_number}</Text>
          <Text style={styles.orderMeta} numberOfLines={1}>
            {FULFILLMENT_LABEL[order.fulfillment_mode] ?? 'Delivery'}
          </Text>
          <Text style={styles.orderTotal}>{peso(Number(order.grand_total))}</Text>
        </View>
        <View style={styles.orderSide}>
          <Badge label={meta.label} status={meta.badge} />
          <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString()}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { gap: 1 },
  title: { ...typography.display, fontSize: 27 },
  subtitle: { ...typography.caption },

  skeletonList: { gap: spacing.sm },
  skeletonRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  skeletonBody: { flex: 1, gap: 7 },

  list: { gap: spacing.sm },
  orderCard: { padding: spacing.md },
  orderInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  orderIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBody: { flex: 1, gap: 2 },
  orderNo: { ...typography.subhead, fontWeight: '700' },
  orderMeta: { ...typography.caption },
  orderTotal: { ...typography.price, fontSize: 15 },
  orderSide: { alignItems: 'flex-end', gap: 5 },
  orderDate: { ...typography.micro, color: colors.faint },

  sheetBody: { gap: spacing.md },
  sheetFoot: { gap: spacing.sm },
  sheetTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTotal: { ...typography.price, fontSize: 17 },
  muted: { ...typography.caption },
  sectionTitle: { ...typography.label, color: colors.text, marginTop: spacing.xs },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemQty: { ...typography.caption, color: colors.faint, width: 24 },
  itemName: { ...typography.body, flex: 1 },
  itemValue: { ...typography.subhead, fontWeight: '600' },
  pickupCard: { alignItems: 'center', padding: spacing.base },
  pickupHint: { ...typography.caption },
  pickupNo: { ...typography.display, color: colors.primaryDeep },
});
