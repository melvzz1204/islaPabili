import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@isla/supabase';
import {
  AppIcon,
  Button,
  Card,
  colors,
  EmptyState,
  radius,
  Screen,
  ScreenHeader,
  spacing,
  typography,
} from '@isla/ui';
import { useCart } from '../marketplace/cart';
import { peso } from '../marketplace/data';
import { ProductTile, QtyStepper } from '../marketplace/components';
import { requestCheckoutReturn } from '../lib/checkoutReturn';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import { goToTab, type RootNavProp, type RootStackScreen } from '../navigation/types';
import { useNavigation } from '@react-navigation/native';

type Props = RootStackScreen<'Cart'>;

const EMPTY_HINT = 'Browse a store, add what you need, and your cart will show up here.';

export default function CartScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { session } = useAuth();
  const { lines, count, subtotal, setQty, remove, clear } = useCart();

  const goShop = () => goToTab(navigation, 'Shop');

  const handleCheckout = () => {
    if (!session) {
      requestCheckoutReturn();
      navigation.navigate('AuthHome');
      return;
    }
    navigation.navigate('Checkout');
  };

  return (
    <Screen
      footer={
        count > 0 ? (
          <View style={styles.footerStack}>
            <View style={styles.footer}>
              <View style={styles.footerTotals}>
                <Text style={styles.footerLabel}>Subtotal</Text>
                <Text style={styles.footerValue}>{peso(subtotal)}</Text>
              </View>
              <Button
                title={session ? 'Checkout' : 'Log in to checkout'}
                onPress={handleCheckout}
                size="lg"
                fullWidth={false}
                style={styles.footerBtn}
              />
            </View>
            <BottomNav />
          </View>
        ) : (
          <BottomNav />
        )
      }
      footerHeight={count > 0 ? 96 + BOTTOM_NAV_HEIGHT : BOTTOM_NAV_HEIGHT}
    >
      <ScreenHeader title="Your cart" onBack={() => navigation.goBack()} />

      {count === 0 ? (
        <EmptyState
          title="Your cart is empty"
          message={EMPTY_HINT}
          icon="cart"
          action={<Button title="Start shopping" onPress={goShop} />}
        />
      ) : (
        <>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              {count} item{count === 1 ? '' : 's'} from {new Set(lines.map((l) => l.merchantId)).size} store
              {new Set(lines.map((l) => l.merchantId)).size === 1 ? '' : 's'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear cart"
              onPress={clear}
              hitSlop={8}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </View>

          <View style={styles.lines}>
            {lines.map((line) => (
              <CartLineRow
                key={line.productId}
                name={line.name}
                price={line.price}
                qty={line.qty}
                photoUrl={line.photoUrl}
                onChange={(q) => setQty(line.productId, q)}
                onRemove={() => remove(line.productId)}
              />
            ))}
          </View>

          <Card variant="tinted" style={styles.noteCard}>
            <View style={styles.noteRow}>
              <AppIcon name="rider" size={20} color={colors.primaryDeep} />
              <View style={styles.noteText}>
                <Text style={styles.noteTitle}>Delivery is calculated at checkout</Text>
                <Text style={styles.noteBody}>
                  Fees depend on distance and the rider assigned to your pabili.
                </Text>
              </View>
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

type CartLineRowProps = {
  name: string;
  price: number;
  qty: number;
  photoUrl: string | null;
  onChange: (qty: number) => void;
  onRemove: () => void;
};

function CartLineRow({ name, price, qty, photoUrl, onChange, onRemove }: CartLineRowProps) {
  return (
    <Card variant="flat" style={styles.line} padded={false}>
      <View style={styles.lineInner}>
        <ProductTile name={name} photoUrl={photoUrl} size={64} />
        <View style={styles.lineBody}>
          <Text style={styles.lineName} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.lineUnit}>{peso(price)} each</Text>
          <View style={styles.lineFoot}>
            <QtyStepper qty={qty} onChange={onChange} label={name} />
            <Text style={styles.lineTotal}>{peso(price * qty)}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${name} from cart`}
          onPress={onRemove}
          hitSlop={8}
          style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
        >
          <AppIcon name="trash" size={16} color={colors.faint} />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryText: { ...typography.caption, flex: 1 },
  clearText: { ...typography.label, color: colors.danger },

  lines: { gap: spacing.sm },
  line: { padding: spacing.md },
  lineInner: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  lineBody: { flex: 1, gap: 2 },
  lineName: { ...typography.subhead, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  lineUnit: { ...typography.caption },
  lineFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  lineTotal: { ...typography.price, fontSize: 15.5 },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noteCard: { padding: spacing.base },
  noteRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  noteText: { flex: 1, gap: 2 },
  noteTitle: { ...typography.label, color: colors.primaryDeep },
  noteBody: { ...typography.caption, color: colors.primaryDeep },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  footerStack: { gap: spacing.sm },
  footerTotals: { flex: 1, gap: 1 },
  footerLabel: { ...typography.caption },
  footerValue: { ...typography.price, fontSize: 19 },
  footerBtn: { minWidth: 168 },

  pressed: { opacity: 0.6 },
});
