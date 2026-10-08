import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { File as FileHandle } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { signOut, useAuth, type Database } from '@isla/supabase';
import {
  AuthHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  Screen,
  ScreenHeader,
  SegmentedTabs,
  SheetModal,
  colors,
  radius,
  spacing,
  typography,
  useToast,
  type BadgeStatus,
} from '@isla/ui';
import { TextField } from '../ui/TextField';
import { peso } from '../marketplace/data';
import { canStoreChat } from '../messaging/chat';
import type { RootNavProp } from '../navigation/types';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type MerchantRow = Database['public']['Tables']['merchants']['Row'];

type HomeTab = 'overview' | 'orders' | 'verify' | 'store';
type InboxTab = 'new' | 'preparing' | 'ready' | 'all';

const INBOX_STATUS: Record<InboxTab, string[]> = {
  new: ['awaiting_merchant'],
  preparing: ['preparing'],
  ready: ['ready'],
  all: [],
};

const FULFILLMENT_LABEL: Record<string, string> = {
  merchant_delivery: 'Rider delivery',
  merchant_pickup: 'Self-pickup',
  rider_pabili: 'Rider pabili',
};

const STATUS_BADGE: Record<string, BadgeStatus> = {
  awaiting_merchant: 'warning',
  preparing: 'primary',
  ready: 'success',
  in_transit: 'primary',
  delivered: 'warning',
  declined: 'danger',
  cancelled: 'danger',
  completed: 'neutral',
};

const statusLabel = (s: string) => s.replaceAll('_', ' ').toUpperCase();

const linePrice = (it: OrderItem) => Number(it.final_price ?? it.estimated_price ?? 0);

/** Orders that no longer earn (excluded from revenue stats). */
const DEAD_STATUSES = new Set(['cancelled', 'failed', 'declined']);

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const timeAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
};

/** store-logos storage path (or absolute URL) → fetchable URL. */
const resolveStoreImage = (client: ReturnType<typeof useAuth>['client'], path: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return client.storage.from('store-logos').getPublicUrl(path).data.publicUrl;
};

export default function MerchantHomeScreen({ merchantId }: { merchantId: string }) {
  const [tab, setTab] = useState<HomeTab>('overview');
  return (
    <Screen>
      <ScreenHeader title="My store" />
      <SegmentedTabs<HomeTab>
        segments={[
          { value: 'overview', label: 'Overview' },
          { value: 'orders', label: 'Orders' },
          { value: 'verify', label: 'Verify' },
          { value: 'store', label: 'Store' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'overview' ? <MerchantOverview merchantId={merchantId} onGoOrders={() => setTab('orders')} /> : null}
      {tab === 'orders' ? <MerchantOrders merchantId={merchantId} /> : null}
      {tab === 'verify' ? <MerchantVerify merchantId={merchantId} /> : null}
      {tab === 'store' ? <MerchantStore merchantId={merchantId} /> : null}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Overview: hero + analytics + needs-action                           */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

function MerchantOverview({ merchantId, onGoOrders }: { merchantId: string; onGoOrders: () => void }) {
  const { client } = useAuth();
  const { showToast } = useToast();
  const [store, setStore] = useState<MerchantRow | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    const [{ data: m, error: mErr }, { data: o, error: oErr }] = await Promise.all([
      client.from('merchants').select('*').eq('id', merchantId).maybeSingle(),
      client
        .from('orders')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    if (mErr) setLoadError(mErr.message);
    else setStore((m ?? null) as MerchantRow | null);
    if (oErr) setLoadError((prev) => prev ?? oErr.message);
    else {
      setOrders((o ?? []) as OrderRow[]);
      if (!mErr) setLoadError(null);
    }
    setLoading(false);
  }, [client, merchantId]);

  useEffect(() => {
    void load();
    const channel = client
      .channel(`orders-merchant-overview-${merchantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `merchant_id=eq.${merchantId}` },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, merchantId, load]);

  const stats = useMemo(() => {
    const now = new Date();
    const todayOrders = orders.filter((o) => sameDay(new Date(o.created_at), now));
    const revenue = todayOrders
      .filter((o) => !DEAD_STATUSES.has(o.status))
      .reduce((sum, o) => sum + Number(o.grand_total ?? 0), 0);
    const pending = orders.filter((o) => o.status === 'awaiting_merchant');
    const done = orders.filter((o) => o.status === 'completed').length;
    const rate = orders.length > 0 ? Math.round((done / orders.length) * 100) : 0;
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      const count = orders.filter((o) => sameDay(new Date(o.created_at), d)).length;
      return { key: d.toISOString().slice(0, 10), label: 'SMTWTFS'[d.getDay()] ?? '', count };
    });
    const max = Math.max(1, ...days.map((d) => d.count));
    const attention = [...pending]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, 3);
    return { todayOrders: todayOrders.length, revenue, pending: pending.length, rate, days, max, attention };
  }, [orders]);

  const toggleLive = async () => {
    if (!store) return;
    setToggling(true);
    try {
      const next = !store.is_active;
      const { error } = await client.from('merchants').update({ is_active: next }).eq('id', merchantId);
      if (error) throw new Error(error.message);
      setStore({ ...store, is_active: next });
      showToast({
        message: next ? 'Store is live. Customers can order again.' : 'Store paused. New orders are blocked until you go live.',
        type: next ? 'success' : 'info',
      });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Could not change status.', type: 'error' });
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.section}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (loadError && !store && orders.length === 0) {
    return (
      <View style={styles.section}>
        <EmptyState
          title="Could not load dashboard"
          message={loadError}
          action={<Button title="Try again" onPress={() => { setLoading(true); void load(); }} />}
        />
      </View>
    );
  }

  const logoSrc = resolveStoreImage(client, store?.logo_url ?? null);

  return (
    <View style={styles.section}>
      <Card variant="tinted">
        <View style={styles.heroRow}>
          {logoSrc ? (
            <Image source={{ uri: logoSrc }} style={styles.heroLogo} />
          ) : (
            <View style={styles.heroLogoEmpty}>
              <Text style={styles.logoLetter}>{(store?.name ?? 'S').slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.logoText}>
            <Text style={styles.orderNumber}>{store?.name ?? 'My store'}</Text>
            <Text style={styles.cardSub}>
              {store ? `${store.town} · ${String(store.category).replace('_', ' ')}` : 'Store dashboard'}
            </Text>
          </View>
          <Badge label={store?.is_active ? 'Live' : 'Paused'} status={store?.is_active ? 'success' : 'neutral'} />
        </View>
        <View style={styles.cardActions}>
          <Button
            title={toggling ? 'Working…' : store?.is_active ? 'Pause store' : 'Go live'}
            variant={store?.is_active ? 'secondary' : 'primary'}
            onPress={() => void toggleLive()}
            disabled={toggling || !store}
          />
          <Button
            title={stats.pending > 0 ? `Review ${stats.pending} new order${stats.pending === 1 ? '' : 's'}` : 'View orders'}
            variant="secondary"
            onPress={onGoOrders}
          />
        </View>
      </Card>

      <View style={styles.statGrid}>
        <StatCard label="Today" value={String(stats.todayOrders)} hint="orders" />
        <StatCard label="Revenue today" value={peso(stats.revenue)} hint="excl. cancelled" />
        <StatCard label="Needs action" value={String(stats.pending)} hint="awaiting accept" />
        <StatCard label="Completed" value={`${stats.rate}%`} hint="of last 100" />
      </View>

      <Card>
        <Text style={styles.detailTitle}>Last 7 days</Text>
        <View style={styles.bars}>
          {stats.days.map((d) => (
            <View key={d.key} style={styles.barCol}>
              <Text style={styles.barCount}>{d.count}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    d.count > 0 ? { height: `${Math.max(8, Math.round((d.count / stats.max) * 100))}%` } : { height: 3 },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{d.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      {stats.attention.length > 0 ? (
        <Card>
          <Text style={styles.detailTitle}>Needs your confirmation</Text>
          <Text style={styles.cardSub}>Oldest first — accept so the kitchen can start.</Text>
          {stats.attention.map((o) => (
            <View key={o.id} style={styles.attentionRow}>
              <View style={styles.itemText}>
                <Text style={styles.itemName}>{o.order_number}</Text>
                <Text style={styles.cardSub}>
                  {timeAgo(o.created_at)} · {peso(Number(o.grand_total))}
                </Text>
              </View>
              <Button title="Review" variant="secondary" onPress={onGoOrders} />
            </View>
          ))}
        </Card>
      ) : (
        <EmptyState
          compact
          title="All caught up"
          message="New customer orders will pop up here the moment they arrive."
        />
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Orders inbox                                                        */
/* ------------------------------------------------------------------ */

function MerchantOrders({ merchantId }: { merchantId: string }) {
  const { client } = useAuth();
  const { showToast } = useToast();
  const [inbox, setInbox] = useState<InboxTab>('new');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<OrderRow | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await client
      .from('orders')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      setLoadError(error.message);
    } else {
      setOrders((data ?? []) as OrderRow[]);
      setLoadError(null);
    }
    setLoading(false);
    setRefreshing(false);
  }, [client, merchantId]);

  useEffect(() => {
    void load();
    const channel = client
      .channel(`orders-merchant-${merchantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `merchant_id=eq.${merchantId}` },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, merchantId, load]);

  const counts = useMemo(
    () => ({
      new: orders.filter((o) => o.status === 'awaiting_merchant').length,
      preparing: orders.filter((o) => o.status === 'preparing').length,
      ready: orders.filter((o) => o.status === 'ready').length,
      all: orders.length,
    }),
    [orders],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scoped = inbox === 'all' ? orders : orders.filter((o) => INBOX_STATUS[inbox]?.includes(o.status));
    if (!q) return scoped;
    return scoped.filter((o) =>
      `${o.order_number} ${o.dropoff_address ?? ''}`.toLowerCase().includes(q),
    );
  }, [orders, inbox, query]);

  const refreshSelected = useCallback(
    async (id: string) => {
      const { data } = await client.from('orders').select('*').eq('id', id).maybeSingle();
      if (data) setSelected(data);
      await load();
    },
    [client, load],
  );

  return (
    <View style={styles.section}>
      <SegmentedTabs<InboxTab>
        segments={[
          { value: 'new', label: 'New', badge: counts.new },
          { value: 'preparing', label: 'Preparing', badge: counts.preparing },
          { value: 'ready', label: 'Ready', badge: counts.ready },
          { value: 'all', label: 'All' },
        ]}
        value={inbox}
        onChange={setInbox}
      />
      <TextField
        placeholder="Search order no. or address…"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
      />
      <View style={styles.toolbarRow}>
        <Text style={styles.cardSub}>
          {visible.length} of {orders.length} order{orders.length === 1 ? '' : 's'}
        </Text>
        <Button
          title={refreshing ? 'Refreshing…' : 'Refresh'}
          variant="ghost"
          onPress={() => { setRefreshing(true); void load(); }}
          disabled={refreshing || loading}
        />
      </View>
      {loadError ? (
        <Card variant="tinted">
          <Text style={styles.orderNumber}>Could not load orders</Text>
          <Text style={styles.cardSub}>{loadError}</Text>
          <View style={styles.cardActions}>
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => { setRefreshing(true); void load(); }}
              disabled={refreshing}
            />
          </View>
        </Card>
      ) : null}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={query.trim() ? 'No matches' : 'Nothing here'}
          message={
            query.trim()
              ? `No orders match "${query.trim()}" in this tab.`
              : inbox === 'all'
                ? 'New customer orders appear here instantly.'
                : `No ${inbox} orders right now.`
          }
        />
      ) : (
        visible.map((o) => (
          <Card key={o.id}>
            <View style={styles.cardHead}>
              <View style={styles.cardTitle}>
                <Text style={styles.orderNumber}>
                  {o.order_number} <Text style={styles.timeAgo}>· {timeAgo(o.created_at)}</Text>
                </Text>
                <Text style={styles.cardSub}>
                  {(FULFILLMENT_LABEL[o.fulfillment_mode] ?? o.fulfillment_mode) + ' · ' + peso(Number(o.grand_total))}
                </Text>
                {o.dropoff_address ? <Text style={styles.cardSub}>{o.dropoff_address}</Text> : null}
              </View>
              <Badge label={statusLabel(o.status)} status={STATUS_BADGE[o.status] ?? 'neutral'} />
            </View>
            <View style={styles.cardActions}>
              <Button title="Details" variant="secondary" onPress={() => setSelected(o)} />
              {o.status === 'awaiting_merchant' ? (
                <>
                  <OrderAction
                    title="Accept"
                    onDone={() => {
                      showToast({ message: `Order ${o.order_number} accepted. Start packing.`, type: 'success' });
                      void load();
                    }}
                    run={() => client.from('orders').update({ status: 'preparing' }).eq('id', o.id)}
                  />
                  <OrderAction
                    title="Decline"
                    variant="danger"
                    onDone={() => {
                      showToast({ message: 'Order declined. The customer was notified.', type: 'info' });
                      void load();
                    }}
                    run={() => client.from('orders').update({ status: 'declined' }).eq('id', o.id)}
                  />
                </>
              ) : null}
            </View>
          </Card>
        ))
      )}
      <SheetModal
        visible={selected != null}
        title={selected ? `Order ${selected.order_number}` : ''}
        subtitle={selected ? FULFILLMENT_LABEL[selected.fulfillment_mode] ?? selected.fulfillment_mode : undefined}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <MerchantOrderDetail
            client={client}
            order={selected}
            onChanged={() => void refreshSelected(selected.id)}
            onClose={() => setSelected(null)}
          />
        ) : (
          <></>
        )}
      </SheetModal>
    </View>
  );
}

function OrderAction({
  title,
  variant = 'primary',
  run,
  onDone,
}: {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  run: () => PromiseLike<{ error: { message: string } | null }>;
  onDone: () => void;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      title={busy ? 'Working…' : title}
      variant={variant}
      disabled={busy}
      onPress={() => {
        setBusy(true);
        Promise.resolve(run())
          .then(({ error }) => {
            if (error) showToast({ message: error.message, type: 'error' });
            else onDone();
          })
          .catch((err) => showToast({ message: err instanceof Error ? err.message : 'Failed.', type: 'error' }))
          .finally(() => setBusy(false));
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Order detail: confirm prices → ready → claim code                   */
/* ------------------------------------------------------------------ */

function MerchantOrderDetail({
  client,
  order,
  onChanged,
  onClose,
}: {
  client: ReturnType<typeof useAuth>['client'];
  order: OrderRow;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const navigation = useNavigation<RootNavProp>();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void client
      .from('order_items')
      .select('*')
      .eq('order_id', order.id)
      .then(({ data }) => {
        if (!active) return;
        setItems(data ?? []);
        const initial: Record<string, string> = {};
        for (const it of data ?? []) {
          if (it.final_price != null) initial[it.id] = String(it.final_price);
        }
        setPrices(initial);
      });
    return () => {
      active = false;
    };
  }, [client, order.id]);

  const receiptTotal = items.reduce((sum, it) => {
    const override = prices[it.id]?.trim();
    const unit = override ? Number(override) : linePrice(it);
    return sum + (Number.isFinite(unit) ? unit : 0) * it.quantity;
  }, 0);

  const editable = order.status === 'awaiting_merchant' || order.status === 'preparing';

  const markReady = async () => {
    for (const it of items) {
      const override = prices[it.id]?.trim();
      if (override !== undefined && override !== '') {
        const value = Number(override);
        if (!Number.isFinite(value) || value < 0) {
          showToast({ message: `Invalid price for ${it.name}.`, type: 'error' });
          return;
        }
      } else if (it.estimated_price == null && it.final_price == null) {
        showToast({ message: `Set a price for ${it.name} first.`, type: 'error' });
        return;
      }
    }
    setSaving(true);
    try {
      for (const it of items) {
        const override = prices[it.id]?.trim();
        if (override !== undefined && override !== '') {
          const { error } = await client.from('order_items').update({ final_price: Number(override) }).eq('id', it.id);
          if (error) throw new Error(error.message);
        }
      }
      const grandTotal = receiptTotal + Number(order.total_delivery_fee) - Number(order.discount_amount);
      const { error } = await client
        .from('orders')
        .update({ est_items_total: receiptTotal, grand_total: grandTotal, status: 'ready' })
        .eq('id', order.id);
      if (error) throw new Error(error.message);
      showToast({ message: 'Order is ready. Customer was notified with the claim code.', type: 'success' });
      onChanged();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Could not mark ready.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.detail}>
      {order.status === 'ready' && order.claim_code ? (
        <Card variant="tinted">
          <Text style={styles.codeLabel}>CLAIM CODE</Text>
          <Text style={styles.code}>{order.claim_code}</Text>
          <Text style={styles.codeHint}>
            {order.fulfillment_mode === 'merchant_pickup'
              ? 'The customer shows this code at the counter. Verify it in the Verify tab.'
              : 'The rider shows this code at pickup. Verify it in the Verify tab.'}
          </Text>
        </Card>
      ) : null}
      <Text style={styles.detailTitle}>Confirm final prices</Text>
      {items.length === 0 ? <Text style={styles.cardSub}>No item lines on this order.</Text> : null}
      {items.map((it) => (
        <View key={it.id} style={styles.itemRow}>
          <View style={styles.itemText}>
            <Text style={styles.itemName}>
              {it.quantity}× {it.name}
            </Text>
            <Text style={styles.cardSub}>Listed {it.estimated_price != null ? peso(Number(it.estimated_price)) : '—'} each</Text>
          </View>
          {editable ? (
            <TextField
              compact
              keyboardType="decimal-pad"
              placeholder={it.estimated_price != null ? String(it.estimated_price) : '0'}
              value={prices[it.id] ?? ''}
              onChangeText={(v) => setPrices((prev) => ({ ...prev, [it.id]: v }))}
              containerStyle={styles.priceInput}
            />
          ) : (
            <Text style={styles.itemTotal}>{peso(linePrice(it) * it.quantity)}</Text>
          )}
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Items total</Text>
        <Text style={styles.totalValue}>{peso(receiptTotal)}</Text>
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Delivery fee</Text>
        <Text style={styles.totalValue}>{peso(Number(order.total_delivery_fee))}</Text>
      </View>
      {Number(order.discount_amount) > 0 ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Discount</Text>
          <Text style={styles.totalValue}>−{peso(Number(order.discount_amount))}</Text>
        </View>
      ) : null}
      {order.status === 'preparing' ? (
        <Button title={saving ? 'Marking ready…' : 'Confirm prices & mark ready'} onPress={() => void markReady()} disabled={saving} />
      ) : null}
      {order.status === 'awaiting_merchant' ? (
        <Text style={styles.cardSub}>Accept this order first, then confirm prices when it is packed.</Text>
      ) : null}
      {canStoreChat(order.status) ? (
        <Button title="Message customer" variant="secondary" onPress={() => navigation.navigate('Chat', { orderId: order.id })} />
      ) : null}
      <Button title="Close" variant="ghost" onPress={onClose} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Verify claim code at the counter                                    */
/* ------------------------------------------------------------------ */

function MerchantVerify({ merchantId }: { merchantId: string }) {
  const { client } = useAuth();
  const { showToast } = useToast();
  const [ready, setReady] = useState<OrderRow[]>([]);
  const [code, setCode] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    const { data } = await client
      .from('orders')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false });
    setReady(data ?? []);
    if (data && data.length > 0 && !data.some((o) => o.id === selectedId)) {
      setSelectedId(data[0]?.id ?? null);
    }
  }, [client, merchantId, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const verify = async () => {
    if (!selectedId) {
      showToast({ message: 'Pick the order being claimed.', type: 'error' });
      return;
    }
    if (!code.trim()) {
      showToast({ message: 'Ask for the claim code and type it in.', type: 'error' });
      return;
    }
    setVerifying(true);
    try {
      const { error } = await client.rpc('verify_claim_code', {
        p_order_id: selectedId,
        p_code: code.trim(),
      });
      if (error) throw new Error(error.message);
      showToast({ message: 'Codes match. Handover complete.', type: 'success' });
      setCode('');
      await load();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Verification failed.', type: 'error' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={styles.section}>
      <AuthHeader icon="storefront" title="Verify claim code" subtitle="Type the code the customer or rider shows you. A match completes the handover." />
      {ready.length === 0 ? (
        <EmptyState title="No ready orders" message="Orders you mark ready will wait here for code verification." />
      ) : (
        <>
          {ready.map((o) => (
            <Card key={o.id}>
              <View style={styles.cardHead}>
                <View style={styles.cardTitle}>
                  <Text style={styles.orderNumber}>{o.order_number}</Text>
                  <Text style={styles.cardSub}>
                    {(FULFILLMENT_LABEL[o.fulfillment_mode] ?? o.fulfillment_mode) + ' · ' + peso(Number(o.grand_total))}
                  </Text>
                </View>
                <Badge label={selectedId === o.id ? 'Selected' : 'Ready'} status={selectedId === o.id ? 'primary' : 'success'} />
              </View>
              {selectedId !== o.id ? (
                <Button title="Select" variant="secondary" onPress={() => setSelectedId(o.id)} />
              ) : null}
            </Card>
          ))}
          <TextField
            label="Claim code"
            placeholder="e.g. KQ7M2X"
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Button title={verifying ? 'Verifying…' : 'Verify & complete'} onPress={() => void verify()} disabled={verifying} />
        </>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Store settings                                                      */
/* ------------------------------------------------------------------ */

function MerchantStore({ merchantId }: { merchantId: string }) {
  const { client, profile } = useAuth();
  const { showToast } = useToast();
  const [store, setStore] = useState<MerchantRow | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let active = true;
    void client
      .from('merchants')
      .select('*')
      .eq('id', merchantId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setStore(data);
        setName(data.name);
        setPhone(data.phone ?? '');
        setAddress(data.address ?? '');
        setDescription(data.description ?? '');
        if (data.logo_url) {
          const { data: url } = client.storage.from('store-logos').getPublicUrl(data.logo_url);
          setLogoUri(url.publicUrl);
        }
      });
    return () => {
      active = false;
    };
  }, [client, merchantId]);

  const changeLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast({ message: 'Allow photo access to change your store photo.', type: 'error' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset || !profile) return;
      setUploading(true);
      let body: FormData | ArrayBuffer;
      if (Platform.OS === 'web') {
        const form = new FormData();
        form.append('file', await (await fetch(asset.uri)).blob(), 'logo.jpg');
        body = form;
      } else {
        body = await new FileHandle(asset.uri).arrayBuffer();
      }
      const path = `store-logos/${profile.id}/logo.jpg`;
      const { error } = await client.storage.from('store-logos').upload(path, body, {
        upsert: true,
        contentType: 'image/jpeg',
      });
      if (error) throw new Error(error.message);
      const { data } = await client.from('merchants').update({ logo_url: path }).eq('id', merchantId);
      if (data) void data;
      const { data: url } = client.storage.from('store-logos').getPublicUrl(path);
      setLogoUri(`${url.publicUrl}?t=${Date.now()}`);
      showToast({ message: 'Store photo updated. Customers see it right away.', type: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Logo upload failed.', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    setUploading(true);
    try {
      const { error } = await client.from('merchants').update({ logo_url: null }).eq('id', merchantId);
      if (error) throw new Error(error.message);
      setLogoUri(null);
      showToast({ message: 'Store photo removed.', type: 'info' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Could not remove photo.', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (name.trim().length < 2) {
      showToast({ message: 'Store name is required.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await client
        .from('merchants')
        .update({
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          description: description.trim() || null,
        })
        .eq('id', merchantId);
      if (error) throw new Error(error.message);
      showToast({ message: 'Store profile saved.', type: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Could not save.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    void signOut(client).catch(() => {
      showToast({ message: 'Could not sign out. Please try again.', type: 'error' });
    });
  };

  const toggleLive = async () => {
    if (!store) return;
    setToggling(true);
    try {
      const next = !store.is_active;
      const { error } = await client.from('merchants').update({ is_active: next }).eq('id', merchantId);
      if (error) throw new Error(error.message);
      setStore({ ...store, is_active: next });
      showToast({
        message: next ? 'Store is live. Customers can order again.' : 'Store paused. New orders are blocked until you go live.',
        type: next ? 'success' : 'info',
      });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Could not change status.', type: 'error' });
    } finally {
      setToggling(false);
    }
  };

  if (!store) {
    return (
      <View style={styles.section}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Card variant="tinted">
        <View style={styles.logoRow}>
          <View style={styles.logoText}>
            <Text style={styles.orderNumber}>Store status</Text>
            <Text style={styles.cardSub}>
              {store.is_active
                ? 'Live. Customers can find and order from this store.'
                : 'Paused. The store is hidden and new orders are blocked.'}
            </Text>
          </View>
          <Badge label={store.is_active ? 'Live' : 'Paused'} status={store.is_active ? 'success' : 'neutral'} />
        </View>
        <Button
          title={toggling ? 'Working…' : store.is_active ? 'Pause store' : 'Go live'}
          variant={store.is_active ? 'secondary' : 'primary'}
          onPress={() => void toggleLive()}
          disabled={toggling}
        />
      </Card>
      <Card variant="tinted">
        <Text style={styles.orderNumber}>Store photo</Text>
        <Text style={styles.cardSub}>
          This is what customers see in the shop list. Bright storefront or best-seller photos sell more.
        </Text>
        <View style={styles.photoWrap}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.photo} />
          ) : (
            <View style={styles.photoEmpty}>
              <Text style={styles.photoLetter}>{(name || 'S').slice(0, 1).toUpperCase()}</Text>
              <Text style={styles.cardSub}>No photo yet</Text>
            </View>
          )}
          {uploading ? (
            <View style={styles.photoOverlay}>
              <ActivityIndicator size="large" color={colors.onPrimary} />
            </View>
          ) : null}
        </View>
        <View style={styles.cardActions}>
          <Button
            title={uploading ? 'Uploading…' : logoUri ? 'Change photo' : 'Add photo'}
            variant="secondary"
            onPress={() => void changeLogo()}
            disabled={uploading}
          />
          {logoUri ? (
            <Button title="Remove" variant="ghost" onPress={() => void removeLogo()} disabled={uploading} />
          ) : null}
        </View>
      </Card>
      <TextField label="Store name" value={name} onChangeText={setName} />
      <TextField label="Contact number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Full address" value={address} onChangeText={setAddress} multiline />
      <TextField
        label="Store description"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        placeholder="Ano ang tinda ninyo?"
      />
      <Button title={saving ? 'Saving…' : 'Save store profile'} onPress={() => void save()} disabled={saving} />
      <Button title="Log out" variant="ghost" onPress={logout} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, paddingBottom: spacing.xxl },
  cardHead: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  cardTitle: { flex: 1, gap: 2 },
  orderNumber: { ...typography.subhead, fontWeight: '700' },
  cardSub: { ...typography.caption, color: colors.muted },
  cardActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.sm },
  detail: { gap: spacing.md, paddingBottom: spacing.lg },
  detailTitle: { ...typography.subhead, fontWeight: '700' },
  itemRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  itemText: { flex: 1, gap: 1 },
  itemName: { ...typography.body, fontWeight: '600' },
  itemTotal: { ...typography.body, fontWeight: '700' },
  priceInput: { minWidth: 110, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { ...typography.body, color: colors.muted },
  totalValue: { ...typography.subhead, fontWeight: '800' },
  codeLabel: { ...typography.caption, color: colors.primaryDeep, fontWeight: '700', letterSpacing: 2 },
  code: { ...typography.title, fontSize: 40, letterSpacing: 6, color: colors.primaryDeep },
  codeHint: { ...typography.caption, color: colors.body, marginTop: spacing.xs },
  logoRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  logo: { width: 64, height: 64, borderRadius: radius.md },
  logoEmpty: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: { ...typography.title, color: colors.primaryDeep },
  logoText: { flex: 1, gap: 2 },
  heroRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  heroLogo: { width: 72, height: 72, borderRadius: radius.lg },
  heroLogoEmpty: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
  },
  statValue: { ...typography.title, fontSize: 22, fontWeight: '800' },
  statLabel: { ...typography.label, fontWeight: '700' },
  statHint: { ...typography.caption, color: colors.muted },
  bars: { flexDirection: 'row', gap: spacing.xs, alignItems: 'stretch', marginTop: spacing.sm },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barCount: { ...typography.caption, fontWeight: '700' },
  barTrack: {
    height: 72,
    width: '100%',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', backgroundColor: colors.primary, borderRadius: radius.sm },
  barLabel: { ...typography.caption, color: colors.muted },
  attentionRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeAgo: { ...typography.caption, color: colors.muted, fontWeight: '400' },
  photoWrap: { marginTop: spacing.sm, marginBottom: spacing.sm },
  photo: { width: '100%', height: 200, borderRadius: radius.lg },
  photoEmpty: {
    width: '100%',
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoLetter: { ...typography.title, fontSize: 44, color: colors.primaryDeep },
  photoOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.lg,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
