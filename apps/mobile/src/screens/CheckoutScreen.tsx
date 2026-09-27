import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { type Town } from '@isla/shared';
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
  type AppIconName,
} from '@isla/ui';
import { mockDeliveryFee, peso } from '../marketplace/data';
import { useCart } from '../marketplace/cart';
import { requestCheckoutReturn } from '../lib/checkoutReturn';
import { SingleTownPicker } from '../ui/TownPicker';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import { goToTab, type RootNavProp, type RootStackScreen } from '../navigation/types';

type Props = RootStackScreen<'Checkout'>;
type PayMethod = 'cod' | 'gcash' | 'maya';
type Fulfillment = 'merchant_delivery' | 'merchant_pickup';

type DbPayment = Database['public']['Enums']['payment_method'];

const PAY_LABELS: Record<PayMethod, string> = {
  cod: 'Cash on delivery',
  gcash: 'GCash',
  maya: 'Maya',
};

const PAY_DB: Record<PayMethod, DbPayment> = { cod: 'cod', gcash: 'ewallet', maya: 'ewallet' };

const FULFILLMENT_OPTIONS: { value: Fulfillment; label: string; icon: AppIconName }[] = [
  { value: 'merchant_delivery', label: 'Rider delivery', icon: 'rider' },
  { value: 'merchant_pickup', label: 'Self pickup', icon: 'storefront' },
];

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
  const [fulfillment, setFulfillment] = useState<Fulfillment>('merchant_delivery');
  const [placing, setPlacing] = useState(false);
  const [placedNumbers, setPlacedNumbers] = useState<string[] | null>(null);

  const { distanceKm, fee: fullFee } = useMemo(() => mockDeliveryFee(), []);
  const fee = fulfillment === 'merchant_delivery' ? fullFee : 0;
  const total = subtotal + fee;
  const goShop = () => goToTab(navigation, 'Shop');
  const goOrders = () => goToTab(navigation, 'Orders');

  // --- States ---------------------------------------------------------------

  if (count === 0 && !placedNumbers) {
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

  if (placedNumbers) {
    return (
      <Screen footer={<BottomNav />} footerHeight={BOTTOM_NAV_HEIGHT}>
        <View style={styles.confirmWrap}>
          <View style={styles.confirmMark}>
            <AppIcon name="check" size={38} color={colors.onPrimary} />
          </View>
          <Text style={styles.confirmTitle}>Order sent to the store</Text>
          <Text style={styles.confirmBody}>
            {fulfillment === 'merchant_pickup'
              ? 'The store will notify you when it is ready. Show your order number at the counter.'
              : 'The store will prepare your order and a rider will deliver it to your door.'}
          </Text>
          <View style={styles.numberRow}>
            {placedNumbers.map((n) => (
              <Badge key={n} label={n} status="transit" />
            ))}
          </View>
          <Button
            title="Track my orders"
            onPress={goOrders}
          />
          <Button title="Back to shopping" variant="secondary" onPress={goShop} />
        </View>
      </Screen>
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
      const groups = new Map<string, typeof lines>();
      for (const l of lines) {
        const g = groups.get(l.merchantId) ?? [];
        g.push(l);
        groups.set(l.merchantId, g);
      }
      const feeShare = groups.size > 0 ? fee / groups.size : 0;
      const numbers: string[] = [];
      for (const [merchantId, items] of groups) {
        const itemsTotal = items.reduce((n, l) => n + l.price * l.qty, 0);
        const { data: order, error: orderError } = await client
          .from('orders')
          .insert({
            customer_id: uid,
            merchant_id: merchantId || null,
            town,
            dropoff_address: address.trim(),
            dropoff_notes: `${name.trim()} · ${phone.trim()}`,
            fulfillment_mode: fulfillment,
            status: 'awaiting_merchant',
            payment_method: PAY_DB[pay],
            est_items_total: itemsTotal,
            total_delivery_fee: Math.round(feeShare * 100) / 100,
            grand_total: Math.round((itemsTotal + feeShare) * 100) / 100,
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
        numbers.push(order.order_number);
      }
      clear();
      setPlacedNumbers(numbers);
      showToast({ message: 'Order placed! The store has been notified.', type: 'success' });
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

      {/* Fulfillment */}
      <View style={styles.section}>
        <SectionHeader title="How do you want it?" />
        <View style={styles.fulfillGrid}>
          {FULFILLMENT_OPTIONS.map((opt) => {
            const active = fulfillment === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={opt.label}
                onPress={() => setFulfillment(opt.value)}
                style={({ pressed }) => [
                  styles.fulfillCard,
                  active && styles.fulfillCardActive,
                  pressed && styles.pressed,
                ]}
              >
                <AppIcon name={opt.icon} size={20} color={active ? colors.primaryDeep : colors.muted} />
                <Text style={[styles.fulfillLabel, active && styles.fulfillLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={styles.fulfillHint}>
                  {opt.value === 'merchant_delivery' ? peso(fullFee) : 'Free'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Details */}
      <View style={styles.section}>
        <SectionHeader title={fulfillment === 'merchant_pickup' ? 'Pickup details' : 'Delivery details'} />
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
          {fulfillment === 'merchant_delivery' ? (
            <>
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
            </>
          ) : null}
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
              {fulfillment === 'merchant_delivery'
                ? `Delivery fee (${distanceKm.toFixed(1)} km)`
                : 'Pickup (no delivery fee)'}
            </Text>
            <Text style={styles.value}>{peso(fee)}</Text>
          </View>
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

  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  footerStack: { gap: spacing.sm },
  footerTotals: { flex: 1, gap: 1 },
  footerLabel: { ...typography.caption },
  footerValue: { ...typography.price, fontSize: 20 },
  footerBtn: { minWidth: 160 },

  pressed: { opacity: 0.7 },
});
