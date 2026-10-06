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

type HomeTab = 'orders' | 'verify' | 'store';
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

export default function MerchantHomeScreen({ merchantId }: { merchantId: string }) {
  const [tab, setTab] = useState<HomeTab>('orders');
  return (
    <Screen>
      <ScreenHeader title="My store" />
      <SegmentedTabs<HomeTab>
        segments={[
          { value: 'orders', label: 'Orders' },
          { value: 'verify', label: 'Verify' },
          { value: 'store', label: 'Store' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'orders' ? <MerchantOrders merchantId={merchantId} /> : null}
      {tab === 'verify' ? <MerchantVerify merchantId={merchantId} /> : null}
      {tab === 'store' ? <MerchantStore merchantId={merchantId} /> : null}
    </Screen>
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
  const [selected, setSelected] = useState<OrderRow | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await client
      .from('orders')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) setOrders(data ?? []);
    setLoading(false);
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

  const visible = inbox === 'all' ? orders : orders.filter((o) => INBOX_STATUS[inbox]?.includes(o.status));

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
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nothing here"
          message={inbox === 'all' ? 'New customer orders appear here instantly.' : `No ${inbox} orders right now.`}
        />
      ) : (
        visible.map((o) => (
          <Card key={o.id}>
            <View style={styles.cardHead}>
              <View style={styles.cardTitle}>
                <Text style={styles.orderNumber}>{o.order_number}</Text>
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
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset || !profile) return;
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
      showToast({ message: 'Store logo updated.', type: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Logo upload failed.', type: 'error' });
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
        <View style={styles.logoRow}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.logo} />
          ) : (
            <View style={styles.logoEmpty}>
              <Text style={styles.logoLetter}>{name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.logoText}>
            <Text style={styles.orderNumber}>{name}</Text>
            <Text style={styles.cardSub}>Your store logo for customers</Text>
          </View>
        </View>
        <Button title="Change logo" variant="secondary" onPress={() => void changeLogo()} />
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
});
