import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { TOWN_CENTERS, fareBreakdownLabel, fareConfigFromDefaults, type FareConfig, TOWN_LABELS, type Town } from '@isla/shared';
import { useAuth, type Database } from '@isla/supabase';
import {
  AppIcon,
  Badge,
  Button,
  Card,
  EmptyState,
  OptionPicker,
  Screen,
  ScreenHeader,
  SectionHeader,
  TextField,
  colors,
  radius,
  spacing,
  typography,
  useToast,
} from '@isla/ui';
import { peso } from '../marketplace/data';
import { loadFareConfig, quoteTrip, type Gps } from '../marketplace/fare';
import { useCart } from '../marketplace/cart';
import { requestCheckoutReturn } from '../lib/checkoutReturn';
import { SingleTownPicker } from '../ui/TownPicker';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import { goToTab, type RootNavProp, type RootStackScreen } from '../navigation/types';

type Props = RootStackScreen<'Checkout'>;
type PayMethod = 'cod' | 'gcash' | 'maya';

type DbPayment = Database['public']['Enums']['payment_method'];

const PAY_LABELS: Record<PayMethod, string> = {
  cod: 'Cash on delivery',
  gcash: 'GCash',
  maya: 'Maya',
};

const PAY_DB: Record<PayMethod, DbPayment> = { cod: 'cod', gcash: 'ewallet', maya: 'ewallet' };

// Self pickup is paused until stores can handle counter handoffs —
// rider delivery is the only live fulfillment mode.
const FULFILLMENT_MODE = 'merchant_delivery' as const;

type PlacedOrder = { id: string; orderNumber: string };

type SummaryLine = { name: string; qty: number; price: number };

/** Frozen at placement (the cart is cleared) so the confirmation can itemize. */
type OrderSummary = {
  lines: SummaryLine[];
  itemCount: number;
  subtotal: number;
  fee: number;
  total: number;
  distanceKm: number;
  feeEstimated: boolean;
  payLabel: string;
  name: string;
  phone: string;
  town: Town;
  townLabel: string;
  address: string;
};

type FindingRider = {
  name: string;
  phone: string;
  avatarUrl: string | null;
  years: number | null;
  licensed: boolean;
};

type Finding = {
  orderIds: string[];
  town: string;
  phase: 'searching' | 'found';
  rider?: FindingRider | null;
};

export default function CheckoutScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { session, profile, client } = useAuth();
  const { lines, count, subtotal, clear } = useCart();
  const { showToast } = useToast();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [town, setTown] = useState<Town | null>(profile?.home_town ?? null);
  const [pay, setPay] = useState<PayMethod>('cod');
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder[] | null>(null);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [finding, setFinding] = useState<Finding | null>(null);
  const [dutyCount, setDutyCount] = useState<number | null>(null);
  const [fareConfig, setFareConfig] = useState<FareConfig>(() => fareConfigFromDefaults());
  const [gps, setGps] = useState<Gps | null>(null);
  const [pinning, setPinning] = useState(false);
  const [merchantGps, setMerchantGps] = useState<Record<string, Gps | null>>({});
  const pulse = useRef(new Animated.Value(0)).current;

  // Live pricing rules from the admin console.
  useEffect(() => {
    void loadFareConfig(client).then(setFareConfig);
  }, [client]);

  // Store GPS per merchant so each store quotes its own real distance.
  useEffect(() => {
    const ids = [...new Set(lines.map((l) => l.merchantId).filter(Boolean))];
    if (ids.length === 0) return;
    let active = true;
    void (async () => {
      const { data } = await client.from('merchants').select('id, lat, lng').in('id', ids);
      if (!active) return;
      const map: Record<string, Gps | null> = {};
      for (const row of (data ?? []) as { id: string; lat: number | null; lng: number | null }[]) {
        map[row.id] = row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : null;
      }
      setMerchantGps(map);
    })();
    return () => {
      active = false;
    };
  }, [client, lines]);

  /** Per-store quotes: store GPS → customer GPS pin (or town centers). */
  const groupQuotes = useMemo(() => {
    const groups = new Map<string, typeof lines>();
    for (const l of lines) {
      const g = groups.get(l.merchantId) ?? [];
      g.push(l);
      groups.set(l.merchantId, g);
    }
    return [...groups.entries()].map(([merchantId, items]) => {
      const itemCount = items.reduce((n, l) => n + l.qty, 0);
      const pickup = merchantGps[merchantId] ?? (town ? TOWN_CENTERS[town] : null);
      const dropoff = gps ?? (town ? TOWN_CENTERS[town] : null);
      if (!pickup || !dropoff) return { merchantId, items, quote: null as null | ReturnType<typeof quoteTrip> };
      const estimated = !merchantGps[merchantId] || !gps;
      return { merchantId, items, quote: quoteTrip({ pickup, dropoff, itemCount, config: fareConfig, estimated }) };
    });
  }, [lines, merchantGps, town, gps, fareConfig]);

  const fee = useMemo(
    () => groupQuotes.reduce((n, g) => n + (g.quote?.fee ?? 0), 0),
    [groupQuotes],
  );
  const distanceKm = useMemo(
    () => groupQuotes.reduce((n, g) => Math.max(n, g.quote?.distanceKm ?? 0), 0),
    [groupQuotes],
  );
  const feeEstimated = groupQuotes.some((g) => !g.quote || g.quote.estimated);
  const total = subtotal + fee;

  const pinLocation = async () => {
    setPinning(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        showToast({ message: 'Location blocked — quoting from your town center.', type: 'error' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      showToast({ message: 'Location pinned — delivery fee now uses real distance.', type: 'success' });
    } catch {
      showToast({ message: 'Could not read your location.', type: 'error' });
    } finally {
      setPinning(false);
    }
  };

  const goShop = () => goToTab(navigation, 'Shop');
  const goOrders = () => goToTab(navigation, 'Orders');
  const uid = session?.user?.id ?? null;

  /** Open the find-a-rider moment on demand from the order summary. */
  const startFinding = () => {
    if (!placed || !summary) return;
    setDutyCount(null);
    setFinding({ orderIds: placed.map((p) => p.id), town: summary.town, phase: 'searching' });
  };

  // Radar pulse while looking for a rider (same moment as the pabili flow).
  useEffect(() => {
    if (!finding || finding.phase !== 'searching') return;
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

  /** Load the assigned rider's public card (profile + application + photo). */
  const showRiderCard = useCallback(
    async (orderId: string, riderId: string) => {
      const [{ data: profile }, { data: application }] = await Promise.all([
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
        prev && prev.orderIds.includes(orderId)
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
    },
    [client],
  );

  const showRiderCardRef = useRef(showRiderCard);
  useEffect(() => {
    showRiderCardRef.current = showRiderCard;
  }, [showRiderCard]);

  // Watch our own orders — when a rider is assigned, pull the rider card.
  const findingPhase = finding?.phase;
  useEffect(() => {
    if (!finding || findingPhase !== 'searching' || !uid) return;
    const channel = client
      .channel(`checkout-finding-${uid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${uid}` },
        (payload) => {
          const row = payload.new as { id?: string; status?: string; rider_id?: string };
          if (
            row?.id &&
            finding.orderIds.includes(row.id) &&
            row.status === 'rider_assigned' &&
            row.rider_id
          ) {
            void showRiderCardRef.current(row.id, row.rider_id);
          }
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, uid, finding, findingPhase]);

  /** Live on-duty headcount covering this town, while the radar is up. */
  useEffect(() => {
    if (!finding || findingPhase !== 'searching') return;
    let alive = true;
    const town = finding.town;
    const loadDuty = async () => {
      const { count } = await client
        .from('rider_status')
        .select('rider_id', { count: 'exact', head: true })
        .eq('on_duty', true)
        .contains('operating_towns', [town]);
      if (alive) setDutyCount(count ?? 0);
    };
    void loadDuty();
    const channel = client
      .channel(`checkout-duty-${town}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_status' }, () => {
        void loadDuty();
      })
      .subscribe();
    return () => {
      alive = false;
      void client.removeChannel(channel);
    };
  }, [client, finding, findingPhase]);

  // --- States ---------------------------------------------------------------

  if (count === 0 && !placed) {
    return (
      <Screen footer={<BottomNav />} footerHeight={BOTTOM_NAV_HEIGHT}>
        <ScreenHeader title="Checkout" onBack={() => navigation.goBack()} />
        <EmptyState
          title="Nothing to check out"
          message="Your cart is empty. Add something from a local store and come back."
          icon="cart"
          action={<Button title="Browse stores" onPress={goShop} />}
        />
      </Screen>
    );
  }

  if (placed && summary) {
    return (
      <>
        <Screen footer={<BottomNav />} footerHeight={BOTTOM_NAV_HEIGHT}>
          <ScreenHeader title="Order confirmed" onBack={goShop} />
          <View style={styles.confirmWrap}>
            <View style={styles.confirmMark}>
              <AppIcon name="check" size={38} color={colors.onPrimary} />
            </View>
            <Text style={styles.confirmTitle}>Order placed!</Text>
            <Text style={styles.confirmBody}>
              A rider will shop for your items and deliver them to you. Tap below when
              you&apos;re ready and we&apos;ll track the handoff live.
            </Text>
            <View style={styles.numberRow}>
              {placed.map((p) => (
                <Badge key={p.id} label={p.orderNumber} status="transit" />
              ))}
            </View>
          </View>

          {/* Receipt */}
          <View style={styles.section}>
            <SectionHeader title={`Order summary (${summary.itemCount})`} />
            <Card variant="flat" style={styles.formCard}>
              {summary.lines.map((l) => (
                <View key={`${l.name}-${l.price}`} style={styles.row}>
                  <Text style={styles.lineName} numberOfLines={1}>
                    {l.qty}× {l.name}
                  </Text>
                  <Text style={styles.value}>{peso(l.price * l.qty)}</Text>
                </View>
              ))}
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.muted}>Subtotal</Text>
                <Text style={styles.value}>{peso(summary.subtotal)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.muted}>
                  Delivery fee ({summary.distanceKm.toFixed(1)} km{summary.feeEstimated ? ', est.' : ''})
                </Text>
                <Text style={styles.value}>{peso(summary.fee)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.total}>{peso(summary.total)}</Text>
              </View>
            </Card>
          </View>

          {/* Payment */}
          <View style={styles.section}>
            <SectionHeader title="Payment" />
            <Card variant="flat" style={styles.formCard}>
              <View style={styles.row}>
                <Text style={styles.lineName}>{summary.payLabel}</Text>
                <Badge label={peso(summary.total)} status="pending" />
              </View>
              <Text style={styles.muted}>
                {summary.payLabel === PAY_LABELS.cod
                  ? `Prepare ${peso(summary.total)} in cash for the rider — items plus delivery.`
                  : 'Simulated e-wallet charge — no real money moves in this build.'}
              </Text>
            </Card>
          </View>

          {/* Delivery */}
          <View style={styles.section}>
            <SectionHeader title="Deliver to" />
            <Card variant="flat" style={styles.formCard}>
              <Text style={styles.lineName}>
                {summary.name} · {summary.phone}
              </Text>
              <Text style={styles.muted}>
                {summary.townLabel} — {summary.address}
              </Text>
            </Card>
          </View>

          <View style={styles.confirmActions}>
            <Button title="Find a rider now" onPress={startFinding} />
            <Button title="Track my orders" variant="secondary" onPress={goOrders} />
            <Button title="Continue shopping" variant="ghost" onPress={goShop} />
          </View>
        </Screen>
        {finding ? (
          <FindingOverlay
            finding={finding}
            orderNumbers={placed.map((p) => p.orderNumber)}
            dutyCount={dutyCount}
            pulse={pulse}
            onTrack={goOrders}
            onDismiss={() => setFinding(null)}
          />
        ) : null}
      </>
    );
  }

  if (!session) {
    return (
      <Screen footer={<BottomNav />} footerHeight={BOTTOM_NAV_HEIGHT}>
        <ScreenHeader title="Checkout" onBack={() => navigation.goBack()} />
        <Card style={styles.gateCard}>
          <View style={styles.gateIcon}>
            <AppIcon name="lock" size={28} color={colors.primaryDeep} />
          </View>
          <Text style={styles.gateTitle}>Log in to place your order</Text>
          <Text style={styles.gateBody}>
            Your cart ({count} item{count === 1 ? '' : 's'}, {peso(subtotal)}) is saved on this device. Log in
            or create an account and we&apos;ll bring you right back here.
          </Text>
          <Button
            title="Log in"
            onPress={() => {
              requestCheckoutReturn();
              navigation.navigate('Login');
            }}
          />
          <Button
            title="Create an account"
            variant="secondary"
            onPress={() => {
              requestCheckoutReturn();
              navigation.navigate('Register');
            }}
          />
        </Card>
      </Screen>
    );
  }

  // --- Place order ----------------------------------------------------------

  const placeOrder = async () => {
    if (!name.trim()) {
      showToast({ message: 'Enter the recipient name.', type: 'error' });
      return;
    }
    if (!phone.trim()) {
      showToast({ message: 'Enter a contact number for the rider.', type: 'error' });
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
    setPlacing(true);
    try {
      const numbers: PlacedOrder[] = [];
      for (const { merchantId, items, quote } of groupQuotes) {
        const itemsTotal = items.reduce((n, l) => n + l.price * l.qty, 0);
        const groupFee = quote?.fee ?? 0;
        const { data: order, error: orderError } = await client
          .from('orders')
          .insert({
            customer_id: uid,
            merchant_id: merchantId || null,
            town,
            dropoff_address: address.trim(),
            dropoff_lat: gps?.lat ?? null,
            dropoff_lng: gps?.lng ?? null,
            dropoff_notes: `${name.trim()} · ${phone.trim()}`,
            fulfillment_mode: FULFILLMENT_MODE,
            status: 'awaiting_merchant',
            payment_method: PAY_DB[pay],
            est_items_total: itemsTotal,
            distance_km: quote ? Math.round(quote.distanceKm * 100) / 100 : undefined,
            base_fare: quote?.baseFare,
            per_km_rate: quote ? Number(fareConfig.per_km_rate) : undefined,
            distance_fee: quote ? Math.round(quote.distanceFee * 100) / 100 : undefined,
            volume_surcharge: quote?.volumeSurcharge ?? 0,
            total_delivery_fee: Math.round(groupFee * 100) / 100,
            grand_total: Math.round((itemsTotal + groupFee) * 100) / 100,
          })
          .select('id, order_number')
          .single();
        if (orderError || !order) throw orderError ?? new Error('Order was not created.');
        const { error: itemsError } = await client.from('order_items').insert(
          items.map((l) => ({
            order_id: order.id,
            name: l.name,
            quantity: l.qty,
            estimated_price: l.price,
          })),
        );
        if (itemsError) throw itemsError;
        numbers.push({ id: order.id, orderNumber: order.order_number });
      }
      clear();
      setPlaced(numbers);
      // Freeze the receipt: the cart is empty from here on.
      setSummary({
        lines: lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price })),
        itemCount: count,
        subtotal,
        fee,
        total,
        distanceKm,
        feeEstimated,
        payLabel: PAY_LABELS[pay],
        name: name.trim(),
        phone: phone.trim(),
        town,
        townLabel: TOWN_LABELS[town] ?? town,
        address: address.trim(),
      });
      showToast({ message: 'Order placed! Review your summary below.', type: 'success' });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Could not place your order.',
        type: 'error',
      });
    } finally {
      setPlacing(false);
    }
  };

  // --- Form -----------------------------------------------------------------

  return (
    <Screen
      footer={
        <View style={styles.footerStack}>
          <View style={styles.footer}>
            <View style={styles.footerTotals}>
              <Text style={styles.footerLabel}>Total</Text>
              <Text style={styles.footerValue}>{peso(total)}</Text>
            </View>
            <Button
              title="Place order"
              loading={placing}
              onPress={() => void placeOrder()}
              fullWidth={false}
              style={styles.footerBtn}
            />
          </View>
          <BottomNav />
        </View>
      }
      footerHeight={96 + BOTTOM_NAV_HEIGHT}
    >
      <ScreenHeader title="Checkout" onBack={() => navigation.goBack()} />

      {/* Fulfillment — rider delivery only; self pickup is paused for now */}
      <View style={styles.section}>
        <SectionHeader title="How do you want it?" />
        <View style={styles.fulfillGrid}>
          <View style={[styles.fulfillCard, styles.fulfillCardActive]}>
            <AppIcon name="rider" size={20} color={colors.primaryDeep} />
            <Text style={[styles.fulfillLabel, styles.fulfillLabelActive]}>Rider delivery</Text>
            <Text style={styles.fulfillHint}>{peso(fee)}</Text>
          </View>
          <View
            style={[styles.fulfillCard, styles.fulfillCardDisabled]}
            accessibilityLabel="Self pickup, coming soon"
          >
            <AppIcon name="storefront" size={20} color={colors.faint} />
            <Text style={styles.fulfillLabelDisabled}>Self pickup</Text>
            <Badge label="Soon" status="neutral" />
          </View>
        </View>
      </View>

      {/* Details */}
      <View style={styles.section}>
        <SectionHeader title="Delivery details" />
        <Card variant="flat" style={styles.formCard}>
          <TextField
            label="Recipient name"
            placeholder="Juan Dela Cruz"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <TextField
            label="Contact number"
            placeholder="09XX XXX XXXX"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Town</Text>
            <SingleTownPicker variant="field" value={town} onChange={setTown} />
          </View>
          <TextField
            label="Address"
            placeholder="Street / barangay / landmark"
            value={address}
            onChangeText={setAddress}
            multiline
          />
          <Button
            title={gps ? 'Location pinned ✓ — tap to re-pin' : 'Use my exact location'}
            variant="secondary"
            loading={pinning}
            onPress={() => void pinLocation()}
          />
          <Text style={styles.muted}>
            {gps
              ? 'Fee uses the real store-to-you distance.'
              : 'Without a pin we estimate from your town center — fee updates when you pin.'}
          </Text>
        </Card>
      </View>

      {/* Payment */}
      <View style={styles.section}>
        <SectionHeader title="Payment" />
        <Card variant="flat" style={styles.formCard}>
          <OptionPicker
            variant="field"
            value={pay}
            onChange={setPay}
            options={(Object.keys(PAY_LABELS) as PayMethod[]).map((m) => ({
              value: m,
              label: m === 'cod' ? PAY_LABELS[m] : `${PAY_LABELS[m]} (simulated)`,
            }))}
          />
        </Card>
      </View>

      {/* Summary */}
      <View style={styles.section}>
        <SectionHeader title={`Order summary (${count})`} />
        <Card variant="flat" style={styles.formCard}>
          {lines.map((l) => (
            <View key={l.productId} style={styles.row}>
              <Text style={styles.lineName} numberOfLines={1}>
                {l.qty}× {l.name}
              </Text>
              <Text style={styles.value}>{peso(l.price * l.qty)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text style={styles.value}>{peso(subtotal)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.muted}>
              Delivery fee ({distanceKm.toFixed(1)} km{feeEstimated ? ', est.' : ''})
            </Text>
            <Text style={styles.value}>{peso(fee)}</Text>
          </View>
          {groupQuotes.map((g) =>
            g.quote && groupQuotes.length > 1 ? (
              <View key={g.merchantId} style={styles.row}>
                <Text style={styles.muted}>· {fareBreakdownLabel(g.quote, peso)}</Text>
              </View>
            ) : null,
          )}
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.total}>{peso(total)}</Text>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  formCard: { gap: spacing.base },

  fulfillGrid: { flexDirection: 'row', gap: spacing.sm },
  fulfillCard: {
    flex: 1,
    gap: 3,
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.hairline,
  },
  fulfillCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  fulfillLabel: { ...typography.label, color: colors.text },
  fulfillLabelActive: { color: colors.primaryDeep },
  fulfillHint: { ...typography.caption },
  fulfillCardDisabled: { opacity: 0.45, backgroundColor: colors.surfaceSunken },
  fulfillLabelDisabled: { ...typography.label, color: colors.faint },

  fieldGroup: { gap: spacing.xs },
  fieldLabel: { ...typography.label },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  lineName: { ...typography.body, flex: 1 },
  value: { ...typography.subhead, fontWeight: '600' },
  muted: { ...typography.caption },
  divider: { height: 1, backgroundColor: colors.hairline },
  totalLabel: { ...typography.subhead, fontWeight: '700' },
  total: { ...typography.heading, color: colors.primaryDeep },

  gateCard: { alignItems: 'center', gap: spacing.md },
  gateIcon: {
    width: 68,
    height: 68,
    borderRadius: radius.xxl,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateTitle: { ...typography.heading, textAlign: 'center' },
  gateBody: { ...typography.body, color: colors.muted, textAlign: 'center' },

  confirmWrap: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  confirmMark: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: { ...typography.display, fontSize: 24, textAlign: 'center' },
  confirmBody: { ...typography.body, color: colors.muted, textAlign: 'center' },
  numberRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  confirmActions: { gap: spacing.sm },

  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  footerStack: { gap: spacing.sm },
  footerTotals: { flex: 1, gap: 1 },
  footerLabel: { ...typography.caption },
  footerValue: { ...typography.price, fontSize: 20 },
  footerBtn: { minWidth: 160 },

  pressed: { opacity: 0.7 },

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

/** Full-screen find-a-rider moment after placing a store order (mirrors pabili). */
function FindingOverlay({
  finding,
  orderNumbers,
  dutyCount,
  pulse,
  onTrack,
  onDismiss,
}: {
  finding: Finding;
  orderNumbers: string[];
  dutyCount: number | null;
  pulse: Animated.Value;
  onTrack: () => void;
  onDismiss: () => void;
}) {
  const label = orderNumbers.join(' · ');
  if (finding.phase === 'found' && finding.rider) {
    const rider = finding.rider;
    return (
      <View style={styles.findOverlay}>
        {rider.avatarUrl ? (
          <Image source={{ uri: rider.avatarUrl }} style={styles.riderAvatar} />
        ) : (
          <View style={styles.findMedallion}>
            <Text style={styles.riderInitials}>
              {rider.name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <Text style={styles.findTitle}>{rider.name}</Text>
        <View style={styles.riderBadges}>
          {rider.licensed ? <Badge label="Licensed ✓" status="delivered" /> : null}
          {rider.years != null ? <Badge label={`${rider.years}y exp`} status="pending" /> : null}
        </View>
        {rider.phone ? <Text style={styles.findSub}>{rider.phone}</Text> : null}
        <Text style={styles.findOrder}>{label} · on the way</Text>
        <View style={styles.findActions}>
          <Button title="Track my order" onPress={onTrack} />
        </View>
      </View>
    );
  }
  if (dutyCount === 0) {
    return (
      <View style={styles.findOverlay}>
        <View style={styles.findMedallion}>
          <AppIcon name="rider" size={44} color={colors.onPrimary} />
        </View>
        <Text style={styles.findTitle}>No riders on duty</Text>
        <Text style={styles.findSub}>
          Your order is saved. We&apos;ll notify you as soon as a rider in {finding.town} accepts
          it.
        </Text>
        <Text style={styles.findOrder}>{label}</Text>
        <View style={styles.findActions}>
          <Button title="Track my orders" onPress={onTrack} />
          <Button title="Keep shopping" variant="secondary" onPress={onDismiss} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.findOverlay}>
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
          ? `Notifying riders in ${finding.town} — first to accept shops for you.`
          : `${dutyCount} rider${dutyCount === 1 ? '' : 's'} on duty in ${finding.town} — first to accept shops and delivers.`}
      </Text>
      <Text style={styles.findOrder}>{label}</Text>
      <View style={styles.findActions}>
        <Button title="Track my orders" onPress={onTrack} />
        <Button title="Keep shopping" variant="secondary" onPress={onDismiss} />
      </View>
    </View>
  );
}
