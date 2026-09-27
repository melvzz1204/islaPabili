import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import type { Town } from '@isla/shared';
import { useAuth } from '@isla/supabase';
import { callRpc } from '../lib/rpc';
import {
  AppIcon,
  AuthHeader,
  Badge,
  Button,
  Card,
  Screen,
  ScreenHeader,
  colors,
  radius,
  spacing,
  typography,
  useToast,
} from '@isla/ui';
import { TextField } from '../ui/TextField';
import { SingleTownPicker } from '../ui/TownPicker';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import { goToTab, type RootNavProp, type RootStackScreen } from '../navigation/types';
import { mockDeliveryFee, peso } from '../marketplace/data';
import { PABILI_COMBOS, type PabiliCombo } from '../marketplace/pabiliCombos';

type Props = RootStackScreen<'PabiliCreate'>;

type ListRow = { name: string; qty: string };

const EMPTY_ROW: ListRow = { name: '', qty: '1' };
const CUSTOM_STORE = '__custom__';

/** Quick-pick stores. Merchant catalog arrives later — for now these + typing. */
const PRESET_STORES = ['Jollibee', 'Public Market'];

export default function PabiliCreateScreen({ route }: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { client, profile } = useAuth();
  const { showToast } = useToast();
  // Deep-link entry (e.g. the Jollibee tile on Home) preloads a combo.
  const preset = PABILI_COMBOS.find((c) => c.id === route.params?.comboId);
  const [rows, setRows] = useState<ListRow[]>(() =>
    preset ? preset.items.map((i) => ({ ...i })) : [{ ...EMPTY_ROW }],
  );
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [town, setTown] = useState<Town | null>(profile?.home_town ?? null);
  const [address, setAddress] = useState(profile?.address ?? '');
  const [storePick, setStorePick] = useState<string | null>(() =>
    preset?.store && PRESET_STORES.includes(preset.store) ? preset.store : null,
  );
  const [customStore, setCustomStore] = useState(() =>
    preset?.store && !PRESET_STORES.includes(preset.store) ? preset.store : '',
  );
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finding, setFinding] = useState<{
    orderId: string;
    orderNumber: string;
    offered: number;
    town: string;
    phase: 'searching' | 'stopped' | 'found';
    rider?: {
      name: string;
      phone: string;
      avatarUrl: string | null;
      years: number | null;
      licensed: boolean;
    } | null;
  } | null>(null);
  const [working, setWorking] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  // Radar pulse while actively searching. Self-restarting JS-driver loop:
  // keeps going indefinitely (Animated.loop can stall on web) and freezes
  // the moment the panel pauses.
  useEffect(() => {
    if (!finding || finding.offered === 0 || finding.phase !== 'searching') return;
    let alive = true;
    pulse.setValue(0);
    const tick = () => {
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && alive) {
          pulse.setValue(0);
          tick();
        }
      });
    };
    tick();
    return () => {
      alive = false;
    };
  }, [finding, pulse]);

  // Finding only ends two ways: the customer stops it, or a rider accepts.
  // Watch our own order — on accept, pull the rider card instead of leaving.
  // (showRiderCard is declared below; the handler only runs after mount.)
  const showRiderCardRef = useRef<(orderId: string, riderId: string) => void>(() => {});
  useEffect(() => {
    if (!finding || finding.offered === 0 || finding.phase === 'found') return;
    const channel = client
      .channel(`pabili-finding-${finding.orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${finding.orderId}` },
        (payload) => {
          const row = payload.new as { status?: string; rider_id?: string };
          if (row?.status === 'rider_assigned' && row.rider_id) {
            void showRiderCardRef.current(finding.orderId, row.rider_id);
          }
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, finding?.orderId, finding?.phase]);

  /** Load the assigned rider's public card (profile + application + photo). */
  const showRiderCard = useCallback(
    async (orderId: string, riderId: string) => {    const [{ data: profile }, { data: application }] = await Promise.all([
      client.from('profiles').select('full_name, phone, avatar_url').eq('id', riderId).maybeSingle(),
      client
        .from('rider_applications')
        .select('rider_photo_url, driving_experience_years, status')
        .eq('rider_id', riderId)
        .maybeSingle(),
    ]);
    let avatarUrl: string | null = profile?.avatar_url ?? null;
    const photoPath = (application?.rider_photo_url ?? '').replace(/^onboarding-docs\//, '');
    if (!avatarUrl && photoPath) {
      const { data: signed } = await client.storage
        .from('onboarding-docs')
        .createSignedUrl(photoPath, 3600);
      avatarUrl = signed?.signedUrl ?? null;
    }
    setFinding((prev) =>
      prev && prev.orderId === orderId
        ? {
            ...prev,
            phase: 'found',
            rider: {
              name: profile?.full_name?.trim() || 'Your rider',
              phone: profile?.phone?.trim() || '',
              avatarUrl,
              years: application?.driving_experience_years ?? null,
              licensed: application?.status === 'approved',
            },
          }
        : prev,
    );
  }, [client]);

  // Keep the realtime handler above pointed at the latest loader.
  useEffect(() => {
    showRiderCardRef.current = showRiderCard;
  }, [showRiderCard]);

  /** Live on-duty headcount covering this town, while the radar is up. */
  const [dutyCount, setDutyCount] = useState<number | null>(null);
  useEffect(() => {
    if (!finding || finding.phase !== 'searching') return;
    let alive = true;
    const loadDuty = async () => {
      const { count } = await client
        .from('rider_status')
        .select('rider_id', { count: 'exact', head: true })
        .eq('on_duty', true)
        .contains('operating_towns', [finding.town]);
      if (alive) setDutyCount(count ?? 0);
    };
    void loadDuty();
    const channel = client
      .channel(`rider-duty-${finding.town}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_status' }, () => {
        void loadDuty();
      })
      .subscribe();
    return () => {
      alive = false;
      void client.removeChannel(channel);
    };
  }, [client, finding]);

  /** Stop finding = pause the search (request stays open). Cancel kills it. */
  const pauseFinding = () => {
    setFinding((prev) => (prev ? { ...prev, phase: 'stopped' } : prev));
  };

  /** Retry = fresh offer round, then back to the live radar. */
  const retryFinding = async () => {
    if (!finding) return;
    setWorking(true);
    const { data: offered, error } = await callRpc<number>(client, 'request_pabili_riders', {
      p_order_id: finding.orderId,
    });
    setWorking(false);
    if (error) {
      showToast({ message: error.message, type: 'error' });
      return;
    }
    showToast({
      message:
        (offered ?? 0) > 0
          ? `Looking again — ${offered} rider${offered === 1 ? '' : 's'} notified.`
          : 'Still no riders on duty. Try again in a bit.',
      type: (offered ?? 0) > 0 ? 'success' : 'error',
    });
    setFinding({ ...finding, offered: offered ?? 0, phase: 'searching' });
  };

  const cancelFinding = async () => {
    if (!finding) return;
    setSubmitting(true);
    const { error } = await client
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', finding.orderId);
    setSubmitting(false);
    if (error) {
      showToast({ message: error.message, type: 'error' });
      return;
    }
    showToast({ message: 'Pabili request cancelled.', type: 'success' });
    goToTab(navigation, 'Orders');
  };

  const { fee } = mockDeliveryFee();

  const setRow = (index: number, patch: Partial<ListRow>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const removeRow = (index: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const named = rows.filter((r) => r.name.trim());
  const storeName =
    storePick === CUSTOM_STORE ? customStore.trim() : (storePick ?? '').trim();

  /** Drop a preset combo into the list (replaces the untouched blank row). */
  const addCombo = (combo: PabiliCombo) => {
    setRows((prev) => {
      const base = prev.length === 1 && !prev[0]!.name.trim() ? [] : prev;
      return [...base, ...combo.items.map((i) => ({ ...i }))];
    });
    if (combo.store) {
      if (PRESET_STORES.includes(combo.store)) {
        setStorePick(combo.store);
        setCustomStore('');
      } else {
        setStorePick(CUSTOM_STORE);
        setCustomStore(combo.store);
      }
    }
    showToast({ message: `${combo.label} added — edit qty as needed.`, type: 'success' });
  };

  const attachGps = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        showToast({ message: 'Location blocked — riders will use your written address.', type: 'error' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      showToast({ message: 'GPS pinned — rider will navigate to you.', type: 'success' });
    } catch {
      showToast({ message: 'Could not read your location.', type: 'error' });
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    if (named.length === 0) {
      showToast({ message: 'Type at least one item you need.', type: 'error' });
      return;
    }
    if (!phone.trim()) {
      showToast({ message: 'Add a contact number for the rider.', type: 'error' });
      return;
    }
    if (!town || !address.trim()) {
      showToast({ message: 'Add your town and delivery address.', type: 'error' });
      return;
    }
    const { data: userData } = await client.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      showToast({ message: 'Session expired. Please log in again.', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const { data: order, error: orderError } = await client
        .from('orders')
        .insert({
          customer_id: uid,
          merchant_id: null,
          town,
          dropoff_address: address.trim(),
          dropoff_lat: coords?.lat ?? null,
          dropoff_lng: coords?.lng ?? null,
          dropoff_notes: `${name.trim()} · ${phone.trim()}`,
          fulfillment_mode: 'rider_pabili',
          status: 'pending_dispatch',
          is_custom_list: true,
          store_name: storeName || null,
          payment_method: 'cod',
          est_items_total: 0,
          total_delivery_fee: fee,
          grand_total: fee,
        })
        .select('id, order_number')
        .single();
      if (orderError || !order) throw orderError ?? new Error('Pabili request was not created.');
      const { error: itemsError } = await client.from('order_items').insert(
        named.map((r) => ({
          order_id: order.id,
          name: r.name.trim(),
          quantity: Math.max(1, Number.parseInt(r.qty, 10) || 1),
        })),
      );
      if (itemsError) throw itemsError;

      // Offer the list to whoever is on duty right now.
      const { data: offered, error: rpcError } = await callRpc<number>(client, 'request_pabili_riders', {
        p_order_id: order.id,
      });
      if (rpcError) throw rpcError;
      setSubmitting(false);
      // Hand off to the full-screen finding moment. It stays until the
      // customer stops it or a rider accepts (realtime handoff above).
      setFinding({
        orderId: order.id,
        orderNumber: order.order_number,
        offered: offered ?? 0,
        town: town!,
        phase: 'searching',
      });
      return;
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Could not send your pabili list.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Screen footer={<BottomNav />} footerHeight={BOTTOM_NAV_HEIGHT}>
      <ScreenHeader title="" onBack={() => navigation.goBack()} />
      <AuthHeader
        icon="pabili"
        accent
        title="Pabili list"
        subtitle="Type what you need — on-duty riders are notified live and the first to accept shops for you."
      />

      <Card>
        <Text style={styles.cardTitle}>Quick combos</Text>
        <Text style={styles.comboHint}>Tap to add the whole set, then edit qty.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.comboRow}>
          {PABILI_COMBOS.map((combo) => (
            <Pressable
              key={combo.id}
              accessibilityRole="button"
              accessibilityLabel={`Add ${combo.label} combo`}
              onPress={() => addCombo(combo)}
              style={({ pressed }) => [styles.comboChip, pressed && styles.pressed]}
            >
              <Text style={styles.comboLabel}>{combo.label}</Text>
              <Text style={styles.comboSub} numberOfLines={1}>
                {combo.items.length} items
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Card>

      <Card>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Items ({named.length})</Text>
          <Badge label="Cash on delivery" status="pending" />
        </View>
        {rows.map((row, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.rowMain}>
              <TextField
                label={i === 0 ? 'Item' : undefined}
                placeholder="e.g. 1kg pork, suka, diapers"
                value={row.name}
                onChangeText={(v) => setRow(i, { name: v })}
              />
            </View>
            <View style={styles.qtyWrap}>
              <TextField
                label={i === 0 ? 'Qty' : undefined}
                placeholder="1"
                keyboardType="number-pad"
                value={row.qty}
                onChangeText={(v) => setRow(i, { qty: v })}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove item ${i + 1}`}
              hitSlop={10}
              onPress={() => removeRow(i)}
              style={styles.remove}
            >
              <AppIcon name="close" size={14} color={colors.muted} />
            </Pressable>
          </View>
        ))}
        <Button title="Add another item" variant="secondary" onPress={() => setRows((p) => [...p, { ...EMPTY_ROW }])} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Where to buy</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.comboRow}>
          {PRESET_STORES.map((store) => {
            const selected = storePick === store;
            return (
              <Pressable
                key={store}
                accessibilityRole="button"
                accessibilityLabel={`Buy at ${store}`}
                accessibilityState={{ selected }}
                onPress={() => {
                  setStorePick(store);
                  setCustomStore('');
                }}
                style={({ pressed }) => [
                  styles.comboChip,
                  selected && styles.comboChipSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.comboLabel, selected && styles.comboLabelSelected]}>{store}</Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Type another store"
            accessibilityState={{ selected: storePick === CUSTOM_STORE }}
            onPress={() => setStorePick(CUSTOM_STORE)}
            style={({ pressed }) => [
              styles.comboChip,
              storePick === CUSTOM_STORE && styles.comboChipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.comboLabel, storePick === CUSTOM_STORE && styles.comboLabelSelected]}>
              Others…
            </Text>
          </Pressable>
        </ScrollView>
        {storePick === CUSTOM_STORE ? (
          <TextField
            label="Store name"
            placeholder="Type which store the rider should go to"
            value={customStore}
            onChangeText={setCustomStore}
          />
        ) : null}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Delivery details</Text>
        <TextField label="Recipient name" placeholder="Juan Dela Cruz" value={name} onChangeText={setName} />
        <TextField
          label="Mobile number"
          placeholder="09XX XXX XXXX"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <Text style={styles.fieldLabel}>Town</Text>
        <SingleTownPicker variant="field" value={town} onChange={setTown} />
        <TextField label="Address" placeholder="Street / barangay / landmark" value={address} onChangeText={setAddress} />
        <Button
          title={coords ? 'GPS pinned ✓ — tap to re-pin' : 'Use my GPS location'}
          variant="secondary"
          loading={locating}
          onPress={() => void attachGps()}
        />
        {coords ? (
          <Text style={styles.gpsHint}>
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} — rider navigates here. Keep GPS on.
          </Text>
        ) : null}
      </Card>

      <Card style={styles.summaryCard}>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Delivery fee (est.)</Text>
          <Text style={styles.feeValue}>{peso(fee)}</Text>
        </View>
        <Text style={styles.finePrint}>
          You pay the rider in cash: item costs + {peso(fee)} delivery. Keep GPS on so the rider finds you fast.
        </Text>
        <Button title="Find a rider" onPress={() => void handleSubmit()} loading={submitting} />
      </Card>
    </Screen>
    {finding ? (
      <View style={styles.findOverlay}>
        {finding.offered > 0 && finding.phase === 'searching' ? (
          <>
            <View style={styles.rings}>
              {[150, 200, 250].map((size) => (
                <Animated.View
                  key={size}
                  style={[
                    styles.ring,
                    {
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
                    },
                  ]}
                />
              ))}
              <View style={styles.findMedallion}>
                <AppIcon name="rider" size={44} color={colors.onPrimary} />
              </View>
            </View>
            <Text style={styles.findTitle}>Finding a rider…</Text>
            <Text style={styles.findSub}>
              {dutyCount == null
                ? `Notifying riders in ${finding.town} — first to accept wins.`
                : `${dutyCount} rider${dutyCount === 1 ? '' : 's'} on duty in ${finding.town} · ${finding.offered} notified — first to accept wins.`}
            </Text>
            <Text style={styles.findOrder}>{finding.orderNumber}</Text>
            <Button
              title="Stop finding"
              variant="danger"
              onPress={pauseFinding}
            />
          </>
        ) : finding.phase === 'found' && finding.rider ? (
          <>
            {finding.rider.avatarUrl ? (
              <Image source={{ uri: finding.rider.avatarUrl }} style={styles.riderAvatar} />
            ) : (
              <View style={styles.findMedallion}>
                <Text style={styles.riderInitials}>
                  {finding.rider.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <Text style={styles.findTitle}>{finding.rider.name}</Text>
            <View style={styles.riderBadges}>
              {finding.rider.licensed ? <Badge label="Licensed ✓" status="delivered" /> : null}
              {finding.rider.years != null ? (
                <Badge label={`${finding.rider.years}y exp`} status="pending" />
              ) : null}
            </View>
            {finding.rider.phone ? (
              <Text style={styles.findSub}>{finding.rider.phone}</Text>
            ) : null}
            <Text style={styles.findOrder}>{finding.orderNumber} · on the way to shop</Text>
            <Button title="Track my order" onPress={() => goToTab(navigation, 'Orders')} />
          </>
        ) : finding.phase === 'stopped' ? (
          <>
            <View style={styles.findMedallion}>
              <AppIcon name="rider" size={44} color={colors.onPrimary} />
            </View>
            <Text style={styles.findTitle}>Finding paused</Text>
            <Text style={styles.findSub}>
              Your list stays open. Retry to ping whoever is on duty now, or cancel the request.
            </Text>
            <Text style={styles.findOrder}>{finding.orderNumber}</Text>
            <View style={styles.findActions}>
              <Button title="Retry finding rider" loading={working} onPress={() => void retryFinding()} />
              <Button
                title="Cancel request"
                variant="danger"
                loading={submitting}
                onPress={() => void cancelFinding()}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.findMedallion}>
              <AppIcon name="rider" size={44} color={colors.onPrimary} />
            </View>
            <Text style={styles.findTitle}>No riders on duty</Text>
            <Text style={styles.findSub}>
              Nobody in {finding.town} is online right now. Your list is saved — retry from Orders when ready.
            </Text>
            <Text style={styles.findOrder}>{finding.orderNumber}</Text>
            <View style={styles.findActions}>
              <Button title="Keep editing" variant="secondary" onPress={() => setFinding(null)} />
              <Button title="View my requests" onPress={() => goToTab(navigation, 'Orders')} />
            </View>
          </>
        )}
      </View>
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...typography.heading, fontSize: 16 },
  comboHint: { ...typography.caption },
  comboRow: { gap: spacing.sm, paddingVertical: 2 },
  comboChip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    gap: 1,
  },
  comboLabel: { ...typography.label, fontWeight: '700', color: colors.primaryDeep },
  comboLabelSelected: { color: colors.onPrimary },
  comboChipSelected: { backgroundColor: colors.primary },
  comboSub: { ...typography.micro, color: colors.primaryDeep },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  rowMain: { flex: 1 },
  qtyWrap: { width: 72 },
  remove: { paddingTop: spacing.lg },
  fieldLabel: { ...typography.label, fontSize: 13, fontWeight: '600' },
  gpsHint: { ...typography.caption, color: colors.success, fontWeight: '600' },
  summaryCard: { borderColor: colors.primary, borderWidth: 1.5 },
  feeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feeLabel: { ...typography.subhead },
  feeValue: { ...typography.price, fontSize: 19 },
  finePrint: { ...typography.caption, textAlign: 'center' },

  findOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  rings: { width: 250, height: 250, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2, borderColor: colors.primary },
  findMedallion: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderAvatar: { width: 112, height: 112, borderRadius: 56 },
  riderInitials: { ...typography.display, fontSize: 34, color: colors.onPrimary },
  riderBadges: { flexDirection: 'row', gap: spacing.sm },
  findTitle: { ...typography.display, fontSize: 26, color: colors.onPrimary, textAlign: 'center' },
  findSub: { ...typography.body, color: colors.onPrimary, opacity: 0.85, textAlign: 'center' },
  findOrder: {
    ...typography.subhead,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.onPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  findActions: { gap: spacing.sm, alignSelf: 'stretch' },
});
