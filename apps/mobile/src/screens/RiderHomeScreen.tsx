import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
  IconButton,
  Screen,
  SectionHeader,
  SheetModal,
  colors,
  radius,
  shadows,
  spacing,
  typography,
  useToast,
  type AppIconName,
} from '@isla/ui';
import { peso } from '../marketplace/data';
import { canChat, setOpenOrderId, useConversations, useIncomingMessageAlerts, type MessageRow } from '../messaging/chat';
import { ChatComposer, ChatEmptyState, ChatThread } from '../messaging/ChatThread';
import {
  CHANNEL_ORDERS,
  getSoundSettings,
  notifyLocal,
  sirenVibrate,
  stopVibration,
} from '../lib/notify';
import { OrderMap, MARINDUQUE_CENTER, type LatLng } from '../maps/OrderMap';
import { useRiderBroadcast } from '../maps/useRiderBroadcast';
import { SoundSettingsForm } from '../components/SoundSettings';

type RiderStatusRow = Database['public']['Tables']['rider_status']['Row'];
type PabiliOrder = Database['public']['Tables']['orders']['Row'];
type PabiliItem = Database['public']['Tables']['order_items']['Row'];
type PabiliRequest = Database['public']['Tables']['order_requests']['Row'];

type IncomingOffer = { request: PabiliRequest; order: PabiliOrder; items: PabiliItem[] };
type DoneOrder = { id: string; order_number: string; total_delivery_fee: number | string | null; created_at: string };

const MINE_STATUSES = ['rider_assigned', 'items_purchased', 'in_transit'] as const;

type OrderStatus = Database['public']['Enums']['order_status'];

const NEXT_STEP: Record<string, { to: OrderStatus; label: string }> = {
  rider_assigned: { to: 'items_purchased', label: 'Mark items purchased' },
  items_purchased: { to: 'in_transit', label: 'On the way' },
  in_transit: { to: 'completed', label: 'Mark as completed' },
};

type RiderTab = 'dashboard' | 'requests' | 'deliveries' | 'messages' | 'earnings' | 'settings';

const TABS: { value: RiderTab; label: string; icon: AppIconName }[] = [
  { value: 'dashboard', label: 'Dashboard', icon: 'home' },
  { value: 'requests', label: 'Requests', icon: 'pabili' },
  { value: 'deliveries', label: 'Deliveries', icon: 'rider' },
  { value: 'messages', label: 'Messages', icon: 'message' },
  { value: 'earnings', label: 'Earnings', icon: 'wallet' },
  { value: 'settings', label: 'Settings', icon: 'settings' },
];

const RIDER_BAR_HEIGHT = 76;

export default function RiderHomeScreen() {
  const { client, profile } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<RiderTab>('dashboard');
  const [onDuty, setOnDuty] = useState(false);
  const [statusRow, setStatusRow] = useState<RiderStatusRow | null>(null);
  const [toggling, setToggling] = useState(false);
  const [incoming, setIncoming] = useState<IncomingOffer[]>([]);
  const [mine, setMine] = useState<PabiliOrder[]>([]);
  const [mineItems, setMineItems] = useState<Record<string, PabiliItem[]>>({});
  const [history, setHistory] = useState<DoneOrder[]>([]);
  const [working, setWorking] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [mapOrderId, setMapOrderId] = useState<string | null>(null);
  const [msgOrderId, setMsgOrderId] = useState<string | null>(null);
  // Full-screen incoming-request takeover (request id, null = none showing).
  const [overlayId, setOverlayId] = useState<string | null>(null);
  const sirenFor = useRef<string | null>(null);

  // Live GPS broadcast while holding an active delivery — this is what the
  // customer watches on the Track screen.
  useRiderBroadcast(mine.length > 0);
  // Live banner for incoming customer messages, anywhere in the rider shell.
  useIncomingMessageAlerts('rider');

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

  /** Completed deliveries: real payout history for stats + weekly chart. */
  const loadHistory = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await client
      .from('orders')
      .select('id, order_number, total_delivery_fee, created_at')
      .eq('rider_id', profile.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return;
    setHistory((data ?? []) as DoneOrder[]);
  }, [client, profile]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // Incoming-request siren: the newest unseen offer takes over the screen
  // with sound + insistent vibration, wherever the rider is in the app.
  useEffect(() => {
    const newest = incoming[0];
    if (!newest || sirenFor.current === newest.request.id) return;
    sirenFor.current = newest.request.id;
    setOverlayId(newest.request.id);
    void (async () => {
      const prefs = await getSoundSettings();
      if (prefs.sounds && prefs.riderRequest) {
        if (prefs.vibrate) sirenVibrate();
        await notifyLocal({
          channel: CHANNEL_ORDERS,
          title: `New pabili · #${newest.order.order_number}`,
          body: `${TOWN_LABELS[newest.order.town]} · ${newest.items.length} items · ${peso(Number(newest.order.total_delivery_fee ?? 0))} fee — first to accept wins.`,
          data: { orderId: newest.order.id, kind: 'pabili' },
        });
      }
    })();
  }, [incoming]);

  // The takeover clears the moment its offer leaves the inbox.
  useEffect(() => {
    if (overlayId && !incoming.some((o) => o.request.id === overlayId)) {
      setOverlayId(null);
      stopVibration();
    }
  }, [incoming, overlayId]);

  useFocusEffect(
    useCallback(() => {
      void loadIncoming();
      void loadMine();
      void loadHistory();
    }, [loadIncoming, loadMine, loadHistory]),
  );

  useEffect(() => {
    if (!profile) return;
    const channel = client
      .channel(`rider-pabili-${profile.id}-${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `rider_id=eq.${profile.id}` },
        () => {
          void loadMine();
          void loadIncoming();
          void loadHistory();
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
  }, [client, profile, loadMine, loadIncoming, loadHistory]);

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
      showToast({ message: error.message, type: 'error' });
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
    await Promise.all([loadMine(), loadHistory()]);
  };

  const handleLogout = () => {
    setLogoutOpen(false);
    // Shell swaps to guest home the moment the session clears; never hold
    // the modal open waiting on the network.
    void signOut(client).catch(() => {
      showToast({ message: 'Could not sign out. Please try again.', type: 'error' });
    });
  };

  const areaLabel = isAllTowns(operatingTowns)
    ? 'All municipalities'
    : isNoTowns(operatingTowns)
      ? 'No operating area set'
      : operatingTowns.map((t) => TOWN_LABELS[t]).join(', ');

  const riderName = profile?.full_name?.trim() || 'Rider';
  const initial = riderName.charAt(0).toUpperCase() || 'R';

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

  const stats = useMemo(() => {
    const totalEarned = history.reduce((n, o) => n + Number(o.total_delivery_fee ?? 0), 0);
    const days: { key: string; label: string; value: number }[] = [];
    const today = new Date();
    for (let back = 6; back >= 0; back -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - back);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      days.push({
        key,
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        value: 0,
      });
    }
    for (const o of history) {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const bucket = days.find((b) => b.key === key);
      if (bucket) bucket.value += Number(o.total_delivery_fee ?? 0);
    }
    return { totalEarned, deliveries: history.length, days };
  }, [history]);

  // Switching tabs always leaves the full-screen map — otherwise the tap
  // looks dead because the map keeps covering the tab content.
  const changeTab = (t: RiderTab) => {
    setMapOrderId(null);
    setTab(t);
  };

  const overlayOffer = overlayId ? (incoming.find((o) => o.request.id === overlayId) ?? null) : null;
  const dismissOverlay = () => {
    stopVibration();
    setOverlayId(null);
  };

  return (
    <Screen footer={<RiderTabBar tab={tab} onChange={changeTab} requestCount={incoming.length} />} footerHeight={RIDER_BAR_HEIGHT}>
      {mapOrderId ? (
        <RiderTrackView
          order={mine.find((o) => o.id === mapOrderId) ?? null}
          onBack={() => setMapOrderId(null)}
          onMessage={(orderId) => {
            setMapOrderId(null);
            setMsgOrderId(orderId);
            setTab('messages');
          }}
        />
      ) : tab === 'dashboard' ? (
        <DashboardView
          name={riderName}
          initial={initial}
          areaLabel={areaLabel}
          requestCount={incoming.length}
          activeCount={mine.length}
          onDuty={onDuty}
          toggling={toggling}
          onToggleDuty={toggleDuty}
          stats={stats}
          onBell={() => setTab('requests')}
          onViewRequests={() => setTab('requests')}
        />
      ) : tab === 'requests' ? (
        <RequestsView
          incoming={incoming}
          working={working}
          distanceTo={distanceTo}
          onRespond={(offer, decision) => void respond(offer, decision)}
        />
      ) : tab === 'deliveries' ? (
        <DeliveriesView
          mine={mine}
          mineItems={mineItems}
          history={history}
          working={working}
          distanceTo={distanceTo}
          onAdvance={(order) => void advance(order)}
          onOpenMap={(order) => setMapOrderId(order.id)}
        />
      ) : tab === 'messages' ? (
        <RiderMessagesView openId={msgOrderId} onOpenChange={setMsgOrderId} />
      ) : tab === 'earnings' ? (
        <EarningsView stats={stats} history={history} />
      ) : (
        <SettingsView
          name={riderName}
          initial={initial}
          areaLabel={areaLabel}
          onDuty={onDuty}
          onLogout={() => setLogoutOpen(true)}
        />
      )}
      <SheetModal
        visible={logoutOpen}
        title="Log out of rider mode?"
        subtitle="Customer mode needs a fresh login."
        onClose={() => setLogoutOpen(false)}
        footer={
          <View style={styles.modalFoot}>
            <Button title="Cancel" variant="secondary" onPress={() => setLogoutOpen(false)} />
            <Button title="Log out" variant="danger" onPress={handleLogout} />
          </View>
        }
      >
        <Text style={styles.muted}>Use your rider login again any time to go back on duty.</Text>
      </SheetModal>
      {overlayOffer ? (
        <IncomingOverlay
          offer={overlayOffer}
          working={working === overlayOffer.order.id}
          onAccept={() => {
            stopVibration();
            void respond(overlayOffer, 'accepted');
          }}
          onDecline={() => {
            stopVibration();
            void respond(overlayOffer, 'declined');
          }}
          onViewAll={() => {
            dismissOverlay();
            changeTab('requests');
          }}
        />
      ) : null}
    </Screen>
  );
}

// --- Incoming takeover (full-screen accept / decline) --------------------------

function IncomingOverlay({
  offer,
  working,
  onAccept,
  onDecline,
  onViewAll,
}: {
  offer: IncomingOffer;
  working: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onViewAll: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remainMs = Math.max(0, +new Date(offer.request.expires_at) - now);
  const mm = Math.floor(remainMs / 60000);
  const ss = Math.floor((remainMs % 60000) / 1000);
  const urgent = remainMs < 60_000;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onViewAll}>
      <View style={styles.takeover}>
        <View style={styles.takeCard}>
          <View style={styles.takeEyebrow}>
            <View style={styles.takePulse} />
            <Text style={styles.takeEyebrowText}>INCOMING PABILI · FIRST TO ACCEPT WINS</Text>
          </View>
          <Text style={styles.takeOrder}>#{offer.order.order_number}</Text>
          <Text style={styles.takeAddr} numberOfLines={2}>
            {TOWN_LABELS[offer.order.town]} · {offer.order.dropoff_address}
          </Text>
          {offer.order.store_name ? (
            <Text style={styles.takeStore} numberOfLines={1}>
              Buy at: {offer.order.store_name}
            </Text>
          ) : null}
          <View style={styles.takeItems}>
            {offer.items.slice(0, 4).map((it) => (
              <Text key={it.id} style={styles.takeItem} numberOfLines={1}>
                {it.quantity}× {it.name}
              </Text>
            ))}
            {offer.items.length > 4 ? (
              <Text style={styles.muted}>+{offer.items.length - 4} more</Text>
            ) : null}
          </View>
          <View style={styles.takeFeeRow}>
            <Text style={styles.takeFee}>{peso(Number(offer.order.total_delivery_fee ?? 0))}</Text>
            <View style={[styles.takeTimer, urgent && styles.takeTimerUrgent]}>
              <AppIcon name="timer" size={15} color={urgent ? colors.onPrimary : colors.warnDark} />
              <Text style={[styles.takeTimerText, urgent && styles.takeTimerTextUrgent]}>
                {mm}:{String(ss).padStart(2, '0')}
              </Text>
            </View>
          </View>
          <View style={styles.takeActions}>
            <View style={styles.takeFlex}>
              <Button title="Accept" loading={working} onPress={onAccept} />
            </View>
            <Button title="Decline" variant="secondary" disabled={working} onPress={onDecline} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="View all requests" onPress={onViewAll}>
            <Text style={styles.takeViewAll}>View all requests</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// --- Dashboard ---------------------------------------------------------------
type Stats = { totalEarned: number; deliveries: number; days: { key: string; label: string; value: number }[] };

function DashboardView({
  name,
  initial,
  areaLabel,
  requestCount,
  activeCount,
  onDuty,
  toggling,
  onToggleDuty,
  stats,
  onBell,
  onViewRequests,
}: {
  name: string;
  initial: string;
  areaLabel: string;
  requestCount: number;
  activeCount: number;
  onDuty: boolean;
  toggling: boolean;
  onToggleDuty: (next: boolean) => void;
  stats: Stats;
  onBell: () => void;
  onViewRequests: () => void;
}) {
  return (
    <View style={styles.tabBody}>
      <View style={styles.greetRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.greetText}>
          <Text style={styles.greetHi}>Welcome back,</Text>
          <Text style={styles.greetName} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <IconButton
          icon="bell"
          label={requestCount > 0 ? `${requestCount} new requests` : 'No new requests'}
          onPress={onBell}
          tone="soft"
          badge={requestCount}
        />
      </View>

      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <View style={styles.statTop}>
            <Text style={styles.statCaption}>Earnings</Text>
            <AppIcon name="earnings" size={18} color={colors.success} />
          </View>
          <Text style={styles.statValue}>{peso(stats.totalEarned)}</Text>
          <Text style={styles.statCaption}>delivery fees paid out</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statTop}>
            <Text style={styles.statCaption}>Deliveries</Text>
            <AppIcon name="rider" size={18} color={colors.accent} />
          </View>
          <Text style={styles.statValue}>{stats.deliveries}</Text>
          <Text style={styles.statCaption}>{activeCount} active now</Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Weekly earnings" subtitle="Delivery fees · last 7 days" />
        <Card>
          <WeeklyBars days={stats.days} />
        </Card>
      </View>

      <Card>
        <View style={styles.dutyRow}>
          <View style={styles.dutyText}>
            <Badge label={onDuty ? 'On duty' : 'Off duty'} status={onDuty ? 'delivered' : 'neutral'} />
            <Text style={styles.dutyLabel}>{onDuty ? 'On duty — accepting pabili' : 'Off duty'}</Text>
            <Text style={styles.dutyHint}>
              {onDuty
                ? `Visible in ${areaLabel}.`
                : 'Flip the switch when you are ready to work.'}
            </Text>
          </View>
          <Switch
            value={onDuty}
            onValueChange={(v) => {
              if (v !== onDuty) void onToggleDuty(v);
            }}
            disabled={toggling}
            trackColor={{ false: colors.border, true: colors.primarySoft }}
            thumbColor={onDuty ? colors.primary : colors.faint}
          />
        </View>
      </Card>

      {requestCount > 0 ? (
        <Card style={styles.offerCta}>
          <View style={styles.offerCtaText}>
            <Text style={styles.offerCtaTitle}>
              {requestCount} new request{requestCount === 1 ? '' : 's'}
            </Text>
            <Text style={styles.offerCtaBody}>First to accept wins — check them now.</Text>
          </View>
          <Button title="View" onPress={onViewRequests} />
        </Card>
      ) : null}
    </View>
  );
}

function WeeklyBars({ days }: { days: { key: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.value));
  const peak = days.reduce((best, d) => (d.value > best.value ? d : best), days[0]!);
  if (peak.value === 0) {
    return <Text style={styles.muted}>No deliveries yet this week — completed payouts show up here.</Text>;
  }
  return (
    <View style={styles.barsRow}>
      {days.map((d) => {
        const hot = d.value === peak.value && d.value > 0;
        return (
          <View key={d.key} style={styles.barCol}>
            <Text style={[styles.barValue, hot && styles.barValueHot]} numberOfLines={1}>
              {d.value > 0 ? `₱${Math.round(d.value)}` : ''}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { height: `${Math.max(6, Math.round((d.value / max) * 100))}%` },
                  hot && styles.barFillHot,
                ]}
              />
            </View>
            <Text style={styles.barDay}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// --- Requests ----------------------------------------------------------------

function RequestsView({
  incoming,
  working,
  distanceTo,
  onRespond,
}: {
  incoming: IncomingOffer[];
  working: string | null;
  distanceTo: (lat: number | null, lng: number | null) => string | null;
  onRespond: (offer: IncomingOffer, decision: 'accepted' | 'declined') => void;
}) {
  return (
    <View style={styles.tabBody}>
      <View style={styles.greetRow}>
        <View style={styles.greetText}>
          <Text style={styles.screenTitle}>Requests</Text>
          <Text style={styles.muted}>
            {incoming.length ? 'First to accept wins' : 'Stay on duty — offers appear here live.'}
          </Text>
        </View>
        {incoming.length ? <Badge label={`${incoming.length} new`} status="pending" /> : null}
      </View>
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
                <Text style={styles.orderNo}>#{offer.order.order_number}</Text>
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
              {peso(Number(offer.order.total_delivery_fee ?? 0))} fee · COD
              {distanceTo(offer.order.dropoff_lat, offer.order.dropoff_lng)
                ? ` · ${distanceTo(offer.order.dropoff_lat, offer.order.dropoff_lng)} away`
                : ''}
            </Text>
            <View style={styles.decisionRow}>
              <View style={styles.decisionFlex}>
                <Button
                  title="Accept"
                  loading={working === offer.order.id}
                  onPress={() => onRespond(offer, 'accepted')}
                />
              </View>
              <Button
                title="Decline"
                variant="secondary"
                disabled={working === offer.order.id}
                onPress={() => onRespond(offer, 'declined')}
              />
            </View>
          </Card>
        ))
      )}
    </View>
  );
}

// --- Deliveries ---------------------------------------------------------------

function DeliveriesView({
  mine,
  mineItems,
  history,
  working,
  distanceTo,
  onAdvance,
  onOpenMap,
}: {
  mine: PabiliOrder[];
  mineItems: Record<string, PabiliItem[]>;
  history: DoneOrder[];
  working: string | null;
  distanceTo: (lat: number | null, lng: number | null) => string | null;
  onAdvance: (order: PabiliOrder) => void;
  onOpenMap: (order: PabiliOrder) => void;
}) {
  return (
    <View style={styles.tabBody}>
      <View style={styles.greetRow}>
        <View style={styles.greetText}>
          <Text style={styles.screenTitle}>Deliveries</Text>
          <Text style={styles.muted}>
            {mine.length ? `${mine.length} in progress` : 'Nothing claimed yet.'}
          </Text>
        </View>
      </View>
      {mine.length === 0 ? (
        <Text style={styles.muted}>Accept a request to start earning.</Text>
      ) : (
        mine.map((o) => {
          const next = NEXT_STEP[o.status];
          const items = mineItems[o.id] ?? [];
          return (
            <Card key={o.id}>
              <View style={styles.orderHead}>
                <View style={styles.orderHeadText}>
                  <Text style={styles.orderNo}>#{o.order_number}</Text>
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
              <Text style={styles.feeLine}>
                {peso(Number(o.total_delivery_fee ?? 0))} fee · COD
                {distanceTo(o.dropoff_lat, o.dropoff_lng)
                  ? ` · ${distanceTo(o.dropoff_lat, o.dropoff_lng)} away`
                  : ''}
              </Text>
              {next ? (
                <Button
                  title={next.label}
                  loading={working === o.id}
                  onPress={() => onAdvance(o)}
                />
              ) : null}
              <Button title="Open map" variant="secondary" onPress={() => onOpenMap(o)} />
            </Card>
          );
        })
      )}
      <View style={styles.section}>
        <SectionHeader title="Completed" subtitle={history.length ? `${history.length} delivered` : undefined} />
        {history.length === 0 ? (
          <Text style={styles.muted}>Finished deliveries show up here.</Text>
        ) : (
          history.slice(0, 20).map((o) => (
            <View key={o.id} style={styles.historyRow}>
              <View style={styles.historyText}>
                <Text style={styles.historyNo}>#{o.order_number}</Text>
                <Text style={styles.muted}>{new Date(o.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.historyFee}>+{peso(Number(o.total_delivery_fee ?? 0))}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

// --- Messages (rider <-> customer per-order chat) -------------------------------

function RiderMessagesView({
  openId,
  onOpenChange,
}: {
  openId: string | null;
  onOpenChange: (orderId: string | null) => void;
}) {
  const { client, profile } = useAuth();
  const { showToast } = useToast();
  const { conversations, loading, refresh } = useConversations('rider');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [sending, setSending] = useState(false);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  // Mute the global message banner while a thread is open here.
  useEffect(() => {
    setOpenOrderId(openId);
    return () => setOpenOrderId(null);
  }, [openId]);

  useEffect(() => {
    const ids = [...new Set(conversations.map((c) => c.order.customer_id))];
    if (ids.length === 0) return;
    let active = true;
    void (async () => {
      const { data } = await client.from('profiles').select('id, full_name').in('id', ids);
      if (!active) return;
      const map: Record<string, string> = {};
      for (const row of (data ?? []) as { id: string; full_name: string }[]) {
        map[row.id] = row.full_name?.trim() || 'Customer';
      }
      setCustomerNames(map);
    })();
    return () => {
      active = false;
    };
  }, [client, conversations]);

  const open = conversations.find((c) => c.order.id === openId)?.order ?? null;

  const loadThread = useCallback(
    async (orderId: string) => {
      const { data } = await client
        .from('order_messages')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })
        .limit(200);
      setMessages((data ?? []) as MessageRow[]);
    },
    [client],
  );

  useEffect(() => {
    if (openId) void loadThread(openId);
    else setMessages([]);
  }, [openId, loadThread]);

  // Per-mount suffix: concurrent mounts must never share a realtime topic
  // (realtime-js throws on `.on()` after `.subscribe()` for the same topic).
  const chatInstanceId = useMemo(() => Math.random().toString(36).slice(2, 9), []);

  useEffect(() => {
    if (!openId) return;
    const channel = client
      .channel(`rider-chat-${openId}-${chatInstanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_id=eq.${openId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, openId, chatInstanceId]);

  const send = async (text: string) => {
    const body = text.trim();
    if (!body || !profile || !openId || sending) return;
    if (open && !canChat(open.status)) {
      showToast({ message: 'This chat is closed — the order is no longer active.', type: 'info' });
      return;
    }
    setSending(true);
    const { error } = await client.from('order_messages').insert({
      order_id: openId,
      sender_id: profile.id,
      body: body.slice(0, 2000),
    });
    setSending(false);
    if (error) {
      showToast({ message: error.message, type: 'error' });
      return;
    }
    await loadThread(openId);
    await refresh();
  };

  if (open) {
    const customer = customerNames[open.customer_id] ?? 'Customer';
    const chatOpen = canChat(open.status);
    return (
      <View style={[styles.tabBody, styles.threadCanvas]}>
        <View style={styles.threadHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to conversations"
            onPress={() => onOpenChange(null)}
            hitSlop={8}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <AppIcon name="back" size={20} color={colors.text} />
          </Pressable>
          <View style={styles.threadAvatar}>
            <Text style={styles.threadAvatarText}>{customer.charAt(0).toUpperCase()}</Text>
            {chatOpen ? <View style={[styles.presenceDot, styles.presenceOnline]} /> : null}
          </View>
          <View style={styles.greetText}>
            <Text style={styles.threadName} numberOfLines={1}>
              {customer}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              #{open.order_number} · {open.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
        <ScrollView
          style={styles.threadScroll}
          contentContainerStyle={styles.threadContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <ChatEmptyState orderNumber={open.order_number} />
          ) : (
            <ChatThread messages={messages} myId={profile?.id ?? ''} />
          )}
        </ScrollView>
        {chatOpen ? (
          <ChatComposer onSend={(body) => send(body)} sending={sending} placeholder="Write to customer…" />
        ) : (
          <Text style={styles.muted}>Chat closed — this order is {open.status.replace(/_/g, ' ')}.</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.tabBody}>
      <View style={styles.greetRow}>
        <View style={styles.greetText}>
          <Text style={styles.screenTitle}>Messages</Text>
          <Text style={styles.muted}>
            {loading
              ? 'Loading…'
              : conversations.length
                ? `${conversations.length} conversation${conversations.length === 1 ? '' : 's'}`
                : 'Accepted orders show up here for chat.'}
          </Text>
        </View>
      </View>
      {conversations.length === 0 && !loading ? (
        <EmptyState
          title="No conversations yet"
          message="Accept a delivery to start chatting with the customer."
          icon="message"
        />
      ) : (
        conversations.map(({ order, lastMessage, unread }) => {
          const customer = customerNames[order.customer_id] ?? 'Customer';
          return (
            <Pressable
              key={order.id}
              accessibilityRole="button"
              accessibilityLabel={`Chat for order ${order.order_number}`}
              onPress={() => onOpenChange(order.id)}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Card variant={unread ? 'tinted' : 'flat'} style={styles.msgCard}>
                <View style={styles.msgAvatar}>
                  <Text style={styles.msgInitial}>{customer.charAt(0).toUpperCase()}</Text>
                  {unread ? <View style={styles.msgDot} /> : null}
                </View>
                <View style={styles.greetText}>
                  <View style={styles.msgTopRow}>
                    <Text style={styles.msgName} numberOfLines={1}>
                      {customer}
                    </Text>
                    {lastMessage ? (
                      <Text style={styles.msgTime}>
                        {new Date(lastMessage.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.msgOrder} numberOfLines={1}>
                    #{order.order_number} · {order.status.replace(/_/g, ' ')}
                  </Text>
                  <Text style={[styles.msgPreview, unread && styles.msgPreviewUnread]} numberOfLines={1}>
                    {lastMessage
                      ? `${lastMessage.sender_id === profile?.id ? 'You: ' : ''}${lastMessage.body}`
                      : 'Say hello to coordinate delivery.'}
                  </Text>
                </View>
                {order.status === 'completed' ? <Badge label="Done" status="delivered" /> : null}
              </Card>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

// --- Rider delivery map (rider sees customer drop-off + self) --------------------

function RiderTrackView({
  order,
  onBack,
  onMessage,
}: {
  order: PabiliOrder | null;
  onBack: () => void;
  onMessage: (orderId: string) => void;
}) {
  const [self, setSelf] = useState<LatLng | null>(null);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted || cancelled) return;
        const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) setSelf({ lat: first.coords.latitude, lng: first.coords.longitude });
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 10_000, distanceInterval: 10 },
          (pos) => {
            if (!cancelled) setSelf({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
        );
      } catch {
        // Map still shows the customer pin without GPS.
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  if (!order) {
    return (
      <View style={styles.tabBody}>
        <View style={styles.mapHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to deliveries"
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <AppIcon name="back" size={20} color={colors.text} />
          </Pressable>
        </View>
        <Text style={styles.muted}>That order is no longer active.</Text>
      </View>
    );
  }

  const dropoff: LatLng | null =
    order.dropoff_lat != null && order.dropoff_lng != null
      ? { lat: order.dropoff_lat, lng: order.dropoff_lng }
      : null;

  return (
    <View style={styles.tabBody}>
      <View style={styles.mapHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to deliveries"
          onPress={onBack}
          hitSlop={8}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <AppIcon name="back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.orderChip}>
          <View style={styles.liveDot} />
          <Text style={styles.orderChipText} numberOfLines={1}>
            #{order.order_number} · {order.status.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>
      <View style={styles.mapBox}>
        <OrderMap
          self={self ?? MARINDUQUE_CENTER}
          selfLabel="You"
          other={dropoff}
          otherLabel="Customer"
          initialCenter={dropoff ?? MARINDUQUE_CENTER}
        />
      </View>
      <Card variant="tinted" style={styles.dropCard}>
        <View style={styles.dropRow}>
          <View style={styles.dropIcon}>
            <AppIcon name="pin" size={20} color={colors.primaryDeep} />
          </View>
          <View style={styles.greetText}>
            <Text style={styles.dropTitle} numberOfLines={1}>
              {TOWN_LABELS[order.town]}
            </Text>
            <Text style={styles.muted} numberOfLines={2}>
              {dropoff ? order.dropoff_address : 'No customer GPS pinned — follow this written address.'}
            </Text>
          </View>
        </View>
        <Button title="Message customer" variant="secondary" onPress={() => onMessage(order.id)} />
      </Card>
    </View>
  );
}

// --- Earnings -----------------------------------------------------------------

function EarningsView({ stats, history }: { stats: Stats; history: DoneOrder[] }) {
  const avg = stats.deliveries > 0 ? stats.totalEarned / stats.deliveries : 0;
  return (
    <View style={styles.tabBody}>
      <View style={styles.greetRow}>
        <View style={styles.greetText}>
          <Text style={styles.screenTitle}>Earnings</Text>
          <Text style={styles.muted}>Delivery fees from completed orders.</Text>
        </View>
      </View>
      <Card style={styles.earnHero}>
        <View style={styles.earnTop}>
          <AppIcon name="wallet" size={28} color={colors.onPrimary} />
          <Text style={styles.earnCaption}>Total earned</Text>
        </View>
        <Text style={styles.earnTotal}>{peso(stats.totalEarned)}</Text>
        <Text style={styles.earnCaption}>
          {stats.deliveries} deliver{stats.deliveries === 1 ? 'y' : 'ies'} · avg {peso(avg)} each
        </Text>
      </Card>
      <View style={styles.section}>
        <SectionHeader title="This week" />
        <Card>
          <WeeklyBars days={stats.days} />
        </Card>
      </View>
      <View style={styles.section}>
        <SectionHeader title="Payout history" />
        {history.length === 0 ? (
          <Text style={styles.muted}>Completed payouts list here with their fees.</Text>
        ) : (
          history.map((o) => (
            <View key={o.id} style={styles.historyRow}>
              <View style={styles.historyText}>
                <Text style={styles.historyNo}>#{o.order_number}</Text>
                <Text style={styles.muted}>{new Date(o.created_at).toLocaleString()}</Text>
              </View>
              <Text style={styles.historyFee}>+{peso(Number(o.total_delivery_fee ?? 0))}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

// --- Settings -----------------------------------------------------------------

function SettingsView({
  name,
  initial,
  areaLabel,
  onDuty,
  onLogout,
}: {
  name: string;
  initial: string;
  areaLabel: string;
  onDuty: boolean;
  onLogout: () => void;
}) {
  return (
    <View style={styles.tabBody}>
      <View style={styles.greetRow}>
        <View style={styles.greetText}>
          <Text style={styles.screenTitle}>Settings</Text>
        </View>
      </View>
      <Card>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.greetText}>
            <Text style={styles.profileName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              {areaLabel}
            </Text>
          </View>
          <Badge label={onDuty ? 'On duty' : 'Off duty'} status={onDuty ? 'delivered' : 'neutral'} />
        </View>
      </Card>
      <Card>
        <View style={styles.settingRow}>
          <AppIcon name="pin" size={20} color={colors.primary} />
          <View style={styles.greetText}>
            <Text style={styles.settingTitle}>Operating area</Text>
            <Text style={styles.muted}>{areaLabel}</Text>
          </View>
        </View>
      </Card>
      <View style={styles.section}>
        <SectionHeader title="Sounds & alerts" />
        <SoundSettingsForm role="rider" />
      </View>
      <Button title="Log out of rider mode" variant="secondary" onPress={onLogout} />
      <Text style={styles.meta}>Customer mode needs a fresh login after logout.</Text>
    </View>
  );
}

// --- Bottom nav ---------------------------------------------------------------

function RiderTabBar({
  tab,
  onChange,
  requestCount,
}: {
  tab: RiderTab;
  onChange: (tab: RiderTab) => void;
  requestCount: number;
}) {
  const { conversations } = useConversations('rider');
  const unreadMessages = conversations.filter((c) => c.unread).length;
  return (
    <View style={[styles.bar, shadows.sticky]}>
      {TABS.map((t) => {
        const active = tab === t.value;
        const badge = t.value === 'requests' ? requestCount : t.value === 'messages' ? unreadMessages : 0;
        return (
          <Pressable
            key={t.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.label}
            onPress={() => onChange(t.value)}
            style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}
          >
            <View style={styles.iconWrap}>
              <AppIcon name={t.icon} size={22} color={active ? colors.primary : colors.faint} />
              {badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBody: { gap: spacing.cardGap },

  greetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  greetText: { flex: 1, gap: 1 },
  greetHi: { ...typography.caption },
  greetName: { ...typography.title, fontSize: 21 },
  screenTitle: { ...typography.title, fontSize: 23 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.heading, color: colors.primaryDeep },

  statRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    gap: 2,
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statValue: { ...typography.display, fontSize: 24 },
  statCaption: { ...typography.caption },

  section: { gap: spacing.md },

  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, minHeight: 150 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barValue: { ...typography.micro, fontSize: 10, color: colors.primaryDeep, height: 14 },
  barValueHot: { color: colors.accentDark, fontWeight: '800' },
  barTrack: {
    width: '70%',
    height: 110,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', backgroundColor: colors.primary, borderRadius: radius.sm },
  barFillHot: { backgroundColor: colors.accent },
  barDay: { ...typography.micro, fontSize: 10 },

  dutyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  dutyText: { flex: 1, gap: spacing.xs, alignItems: 'flex-start' },
  dutyLabel: { ...typography.subhead, fontSize: 17, fontWeight: '700' },
  dutyHint: { ...typography.caption },

  offerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  offerCtaText: { flex: 1, gap: 1 },
  offerCtaTitle: { ...typography.subhead, fontWeight: '700' },
  offerCtaBody: { ...typography.caption },

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

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  historyText: { flex: 1, gap: 1 },
  historyNo: { ...typography.label, fontWeight: '700' },
  historyFee: { ...typography.price, fontSize: 15, color: colors.successDark },

  earnHero: { backgroundColor: colors.primaryDeep, borderWidth: 0, gap: spacing.xs },
  earnTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  earnCaption: { ...typography.caption, color: colors.onPrimary, opacity: 0.8 },
  earnTotal: { ...typography.display, fontSize: 36, color: colors.onPrimary },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  profileName: { ...typography.subhead, fontWeight: '700', fontSize: 16 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  settingTitle: { ...typography.label, fontWeight: '700' },

  muted: { ...typography.caption, color: colors.muted },
  meta: { ...typography.caption, textAlign: 'center' },

  bar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  iconWrap: { position: 'relative' },
  tabLabel: { ...typography.micro, fontSize: 10.5, fontWeight: '600', color: colors.faint },
  tabLabelActive: { color: colors.primary },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { ...typography.micro, fontSize: 10, color: colors.onPrimary },
  modalFoot: { flexDirection: 'row', gap: spacing.sm },
  pressed: { opacity: 0.7 },

  // Rider messages (premium thread on warm canvas)
  threadCanvas: { backgroundColor: colors.chatCanvas, borderRadius: radius.lg, padding: spacing.sm },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadAvatarText: { ...typography.heading, color: colors.onPrimary },
  presenceDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.faint,
    borderWidth: 2.5,
    borderColor: colors.surface,
  },
  presenceOnline: { backgroundColor: colors.success },
  threadName: { ...typography.subhead, fontWeight: '700' },
  threadScroll: { minHeight: 280, maxHeight: 460 },
  threadContent: { paddingBottom: spacing.sm, paddingTop: spacing.xs, flexGrow: 1 },
  msgCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  msgAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgInitial: { ...typography.subhead, fontWeight: '800', color: colors.primaryDeep },
  msgDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  msgTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  msgName: { ...typography.subhead, fontWeight: '700', flex: 1 },
  msgTime: { ...typography.micro, color: colors.faint },
  msgOrder: { ...typography.micro, color: colors.faint, textTransform: 'uppercase' },
  msgPreview: { ...typography.body, color: colors.muted },
  msgPreviewUnread: { color: colors.text, fontWeight: '700' },
  // Rider delivery map
  mapHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  orderChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.base,
    height: 46,
  },
  orderChipText: { ...typography.label, fontWeight: '700', textTransform: 'capitalize', flex: 1 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success },
  mapBox: {
    height: Math.max(480, Math.round(Dimensions.get('window').height * 0.62)),
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  dropCard: { gap: spacing.md, padding: spacing.base },
  dropRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dropIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropTitle: { ...typography.subhead, fontWeight: '700' },

  // Incoming takeover
  takeover: { flex: 1, backgroundColor: 'rgba(4, 32, 30, 0.97)', alignItems: 'center', justifyContent: 'center', padding: spacing.base },
  takeCard: { width: '100%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md, ...shadows.sheet },
  takeEyebrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  takePulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  takeEyebrowText: { ...typography.micro, color: colors.accentDark, fontWeight: '800', letterSpacing: 1 },
  takeOrder: { ...typography.display, fontSize: 32, textAlign: 'center' },
  takeAddr: { ...typography.body, textAlign: 'center' },
  takeStore: { ...typography.subhead, fontWeight: '600', color: colors.primaryDeep, textAlign: 'center' },
  takeItems: { gap: 2, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.md },
  takeItem: { ...typography.body },
  takeFeeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  takeFee: { ...typography.display, fontSize: 30, color: colors.successDark },
  takeTimer: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.warnSoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  takeTimerUrgent: { backgroundColor: colors.danger },
  takeTimerText: { ...typography.label, fontWeight: '800', color: colors.warnDark },
  takeTimerTextUrgent: { color: colors.onPrimary },
  takeActions: { flexDirection: 'row', gap: spacing.sm },
  takeFlex: { flex: 1 },
  takeViewAll: { ...typography.label, color: colors.muted, fontWeight: '700', textAlign: 'center', padding: spacing.xs },
});
