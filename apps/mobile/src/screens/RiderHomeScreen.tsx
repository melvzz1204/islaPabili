import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { isAllTowns, isNoTowns, resolveOptedTowns, TOWN_LABELS, type Town } from '@isla/shared';
import { signOut, useAuth } from '@isla/supabase';
import type { Database } from '@isla/supabase';
import { formatDistance, haversineKm } from '../lib/geo';
import { callRpc } from '../lib/rpc';
import {
  AppIcon,
  Badge,
  Button,
  Card,
  EmptyState,
  Screen,
  SectionHeader,
  colors,
  spacing,
  typography,
  useToast,
} from '@isla/ui';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import { backToShopping } from '../navigation/types';
import type { RootNavProp } from '../navigation/types';
import { peso } from '../marketplace/data';

type RiderStatusRow = Database['public']['Tables']['rider_status']['Row'];
type PabiliOrder = Database['public']['Tables']['orders']['Row'];
type PabiliItem = Database['public']['Tables']['order_items']['Row'];
type PabiliRequest = Database['public']['Tables']['order_requests']['Row'];

type IncomingOffer = { request: PabiliRequest; order: PabiliOrder; items: PabiliItem[] };

const MINE_STATUSES = ['rider_assigned', 'items_purchased', 'in_transit'] as const;

type OrderStatus = Database['public']['Enums']['order_status'];

const NEXT_STEP: Record<string, { to: OrderStatus; label: string }> = {
  rider_assigned: { to: 'items_purchased', label: 'Mark items purchased' },
  items_purchased: { to: 'in_transit', label: 'On the way' },
  in_transit: { to: 'completed', label: 'Mark delivered' },
};

export default function RiderHomeScreen() {
  const { client, profile } = useAuth();
  const navigation = useNavigation<RootNavProp>();
  const { showToast } = useToast();
  const [onDuty, setOnDuty] = useState(false);
  const [statusRow, setStatusRow] = useState<RiderStatusRow | null>(null);
  const [toggling, setToggling] = useState(false);
  const [incoming, setIncoming] = useState<IncomingOffer[]>([]);
  const [mine, setMine] = useState<PabiliOrder[]>([]);
  const [mineItems, setMineItems] = useState<Record<string, PabiliItem[]>>({});
  const [working, setWorking] = useState<string | null>(null);

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

  /** Live offers dispatched to this rider (pending, current round, unexpired). */
  const loadIncoming = useCallback(async () => {
    if (!profile) return;
    const { data: requests, error } = await client
      .from('order_requests')
      .select('*')
      .eq('rider_id', profile.id)
      .eq('status', 'pending')
      .eq('is_current', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error || !requests || requests.length === 0) {
      setIncoming([]);
      return;
    }
    const ids = requests.map((r) => r.order_id);
    const [{ data: orders }, { data: itemRows }] = await Promise.all([
      client.from('orders').select('*').in('id', ids),
      client.from('order_items').select('*').in('order_id', ids),
    ]);
    const orderById = new Map((orders ?? []).map((o) => [o.id, o]));
    const itemsByOrder: Record<string, PabiliItem[]> = {};
    for (const it of itemRows ?? []) {
      (itemsByOrder[it.order_id] ??= []).push(it);
    }
    setIncoming(
      requests.flatMap((request) => {
        const order = orderById.get(request.order_id);
        // Stale request rows (order claimed/cancelled) drop out of the inbox.
        if (!order || order.status !== 'pending_dispatch' || order.rider_id) return [];
        return [{ request, order, items: itemsByOrder[order.id] ?? [] }];
      }),
    );
  }, [client, profile]);

  /** Custom lists this rider already claimed and is still working. */
  const loadMine = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await client
      .from('orders')
      .select('*')
      .eq('rider_id', profile.id)
      .eq('is_custom_list', true)
      .in('status', [...MINE_STATUSES])
      .order('created_at', { ascending: false });
    if (error) return;
    setMine(data ?? []);
    if (!data || data.length === 0) {
      setMineItems({});
      return;
    }
    const { data: itemRows } = await client
      .from('order_items')
      .select('*')
      .in(
        'order_id',
        data.map((o) => o.id),
      );
    const byOrder: Record<string, PabiliItem[]> = {};
    for (const it of itemRows ?? []) {
      (byOrder[it.order_id] ??= []).push(it);
    }
    setMineItems(byOrder);
  }, [client, profile]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useFocusEffect(
    useCallback(() => {
      void loadIncoming();
      void loadMine();
    }, [loadIncoming, loadMine]),
  );

  useEffect(() => {
    if (!profile) return;
    const channel = client
      .channel(`rider-pabili-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `rider_id=eq.${profile.id}` },
        () => {
          void loadMine();
          void loadIncoming();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_requests', filter: `rider_id=eq.${profile.id}` },
        () => {
          void loadIncoming();
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, profile, loadMine, loadIncoming]);

  const toggleDuty = async (next: boolean) => {
    if (!profile) return;
    setToggling(true);
    // Pin the rider's GPS so dispatch and handoff stay accurate. Best effort:
    // duty still toggles if location is blocked.
    let gps: { lat: number; lng: number } | null = null;
    if (next) {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.granted) {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        }
      } catch {
        gps = null;
      }
    }
    const { error } = await client.from('rider_status').upsert({
      rider_id: profile.id,
      on_duty: next,
      // Physical position, which is one town at a time.
      current_town: profile.home_town ?? null,
      current_lat: gps?.lat ?? null,
      current_lng: gps?.lng ?? null,
      last_seen_at: new Date().toISOString(),
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

  /** Accept or decline a dispatched offer. First accept wins server-side. */
  const respond = async (offer: IncomingOffer, decision: 'accepted' | 'declined') => {
    setWorking(offer.order.id);
    const { error } = await callRpc<unknown>(client, 'respond_pabili_request', {
      p_order_id: offer.order.id,
      p_decision: decision,
    });
    setWorking(null);
    if (error) {
      showToast({ message: error.message, type: 'error' });
      await loadIncoming();
      return;
    }
    showToast({
      message:
        decision === 'accepted'
          ? `Accepted ${offer.order.order_number} — customer notified.`
          : 'Passed — the request stays open for other riders.',
      type: 'success',
    });
    await Promise.all([loadIncoming(), loadMine()]);
  };

  const advance = async (order: PabiliOrder) => {
    const next = NEXT_STEP[order.status];
    if (!next) return;
    setWorking(order.id);
    const { error } = await client.from('orders').update({ status: next.to }).eq('id', order.id);
    setWorking(null);
    if (error) {
      showToast({ message: error.message, type: 'error' });
      return;
    }
    showToast({
      message: next.to === 'completed' ? 'Delivered. Salamat!' : 'Status updated — customer notified.',
      type: 'success',
    });
    await loadMine();
  };

  const handleLogout = async () => {
    await signOut(client);
  };

  const areaLabel = isAllTowns(operatingTowns)
    ? 'All municipalities'
    : isNoTowns(operatingTowns)
      ? 'No operating area set'
      : operatingTowns.map((t) => TOWN_LABELS[t]).join(', ');

  /** Straight-line distance from the rider's pinned GPS to a drop-off. */
  const distanceTo = (lat: number | null, lng: number | null): string | null => {
    if (
      statusRow?.current_lat == null ||
      statusRow?.current_lng == null ||
      lat == null ||
      lng == null
    ) {
      return null;
    }
    return formatDistance(haversineKm(statusRow.current_lat, statusRow.current_lng, lat, lng));
  };

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

      {/* Active deliveries */}
      <View style={styles.section}>
        <SectionHeader title="My active pabili" subtitle={mine.length ? `${mine.length} in progress` : undefined} />
        {mine.length === 0 ? (
          <Text style={styles.muted}>Nothing claimed yet. Accept a request below to start earning.</Text>
        ) : (
          mine.map((o) => {
            const next = NEXT_STEP[o.status];
            const items = mineItems[o.id] ?? [];
            return (
              <Card key={o.id}>
                <View style={styles.orderHead}>
                  <View style={styles.orderHeadText}>
                    <Text style={styles.orderNo}>{o.order_number}</Text>
                    <Text style={styles.orderMeta} numberOfLines={2}>
                      {TOWN_LABELS[o.town]} · {o.dropoff_address}
                    </Text>
                  </View>
                  <Badge label={o.status.replace(/_/g, ' ')} status="transit" />
                </View>
                {items.map((it) => (
                  <Text key={it.id} style={styles.itemLine} numberOfLines={1}>
                    {it.quantity}× {it.name}
                    {it.store ? ` (${it.store})` : ''}
                  </Text>
                ))}
                <Text style={styles.contact} numberOfLines={1}>
                  Customer: {o.dropoff_notes || '—'}
                </Text>
                {o.dropoff_lat != null && o.dropoff_lng != null ? (
                  <Text style={styles.gpsLine}>Customer GPS pinned ✓ — keep your GPS on</Text>
                ) : null}
                {items.length > 4 ? <Text style={styles.muted}>+{items.length - 4} more</Text> : null}
                <Text style={styles.feeLine}>
                  Delivery fee {peso(Number(o.total_delivery_fee ?? 0))} · COD
                  {distanceTo(o.dropoff_lat, o.dropoff_lng)
                    ? ` · ${distanceTo(o.dropoff_lat, o.dropoff_lng)} away`
                    : ''}
                </Text>
                {next ? (
                  <Button
                    title={next.label}
                    loading={working === o.id}
                    onPress={() => void advance(o)}
                  />
                ) : null}
              </Card>
            );
          })
        )}
      </View>

      {/* Incoming requests */}
      <View style={styles.section}>
        <SectionHeader
          title="Incoming pabili"
          subtitle={incoming.length ? 'First to accept wins' : undefined}
        />
        {incoming.length === 0 ? (
          <EmptyState
            title="No incoming requests"
            message="Stay on duty with GPS on — customer lists in your area appear here live."
            icon="pabili"
          />
        ) : (
          incoming.map((offer) => (
            <Card key={offer.request.id} style={styles.incomingCard}>
              <View style={styles.orderHead}>
                <View style={styles.orderHeadText}>
                  <Text style={styles.orderNo}>{offer.order.order_number}</Text>
                  <Text style={styles.orderMeta} numberOfLines={2}>
                    {TOWN_LABELS[offer.order.town]} · {offer.order.dropoff_address}
                  </Text>
                </View>
                <Badge label={`${offer.items.length} items`} status="pending" />
              </View>
              {offer.order.store_name ? (
                <Text style={styles.storeLine} numberOfLines={1}>
                  Buy at: {offer.order.store_name}
                </Text>
              ) : null}
              {offer.items.slice(0, 4).map((it) => (
                <Text key={it.id} style={styles.itemLine} numberOfLines={1}>
                  {it.quantity}× {it.name}
                </Text>
              ))}
              {offer.items.length > 4 ? <Text style={styles.muted}>+{offer.items.length - 4} more</Text> : null}
                <Text style={styles.feeLine}>
                  Delivery fee {peso(Number(offer.order.total_delivery_fee ?? 0))} · COD
                  {distanceTo(offer.order.dropoff_lat, offer.order.dropoff_lng)
                    ? ` · ${distanceTo(offer.order.dropoff_lat, offer.order.dropoff_lng)} away`
                    : ''}
                </Text>
              <View style={styles.decisionRow}>
                <View style={styles.decisionFlex}>
                  <Button
                    title="Accept"
                    loading={working === offer.order.id}
                    onPress={() => void respond(offer, 'accepted')}
                  />
                </View>
                <Button
                  title="Decline"
                  variant="secondary"
                  disabled={working === offer.order.id}
                  onPress={() => void respond(offer, 'declined')}
                />
              </View>
            </Card>
          ))
        )}
      </View>

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
  muted: { ...typography.caption, color: colors.muted },

  section: { gap: spacing.md },
  incomingCard: { borderColor: colors.primary, borderWidth: 1.5 },
  decisionRow: { flexDirection: 'row', gap: spacing.sm },
  decisionFlex: { flex: 1 },
  orderHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  orderHeadText: { flex: 1, gap: 1 },
  orderNo: { ...typography.subhead, fontWeight: '700' },
  orderMeta: { ...typography.caption },
  itemLine: { ...typography.body },
  storeLine: { ...typography.subhead, fontWeight: '600', color: colors.primaryDeep },
  gpsLine: { ...typography.caption, color: colors.success, fontWeight: '600' },
  contact: { ...typography.caption, fontWeight: '600' },
  feeLine: { ...typography.caption, color: colors.primaryDeep, fontWeight: '600' },
});
