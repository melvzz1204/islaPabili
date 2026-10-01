import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAuth } from '@isla/supabase';
import { AppIcon, Badge, Button, colors, radius, shadows, spacing, typography } from '@isla/ui';
import { SheetModal } from '@isla/ui';
import { KIND_LABEL, peso, productPhotoSrc, type Merchant, type Product } from './data';
import { useCart } from './cart';

const TILE_COLORS = ['#C2410C', '#15803D', '#1D4ED8', '#9A3412', '#B45309', '#DC2626'];

export function tileColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 997;
  return TILE_COLORS[h % TILE_COLORS.length] ?? TILE_COLORS[0]!;
}

function usePhoto(photoUrl: string | null): string | null {
  const { client } = useAuth();
  return productPhotoSrc(client, photoUrl);
}

// --- ProductTile ------------------------------------------------------------

type ProductTileProps = {
  name: string;
  photoUrl?: string | null;
  /** Omit to let `style` drive the box size (e.g. fluid grid tiles). */
  size?: number;
  radiusOverride?: number;
  style?: StyleProp<ViewStyle>;
};

/** Product image with a tinted monogram fallback until photos are uploaded. */
export function ProductTile({ name, photoUrl, size, radiusOverride, style }: ProductTileProps) {
  const src = usePhoto(photoUrl ?? null);
  const r = radiusOverride ?? radius.md;
  const box: ImageStyle = size ? { width: size, height: size, borderRadius: r } : {};
  if (src) {
    return (
      <Image
        source={{ uri: src }}
        style={[box, { backgroundColor: colors.surfaceSunken }, style as StyleProp<ImageStyle>]}
        accessibilityLabel={`${name} photo`}
      />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={[styles.tile, box, { borderRadius: r, backgroundColor: tileColor(name) }, style]}
    >
      <Text style={[styles.tileLetter, size ? { fontSize: size * 0.4 } : styles.tileLetterFluid]}>
        {initial}
      </Text>
    </View>
  );
}

// --- QtyStepper -------------------------------------------------------------

type QtyStepperProps = {
  qty: number;
  onChange: (qty: number) => void;
  label: string;
  size?: 'sm' | 'md';
};

export function QtyStepper({ qty, onChange, label, size = 'md' }: QtyStepperProps) {
  const btn = size === 'sm' ? styles.stepSm : styles.stepMd;
  return (
    <View
      style={[styles.stepper, size === 'sm' && styles.stepperSm]}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: String(qty) }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease quantity of ${label}`}
        onPress={() => onChange(qty - 1)}
        style={({ pressed }) => [btn, pressed && styles.pressed]}
      >
        <AppIcon name="minus" size={size === 'sm' ? 13 : 15} color={colors.primary} />
      </Pressable>
      <Text style={[styles.stepQty, size === 'sm' && styles.stepQtySm]}>{qty}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase quantity of ${label}`}
        onPress={() => onChange(qty + 1)}
        style={({ pressed }) => [btn, pressed && styles.pressed]}
      >
        <AppIcon name="add" size={size === 'sm' ? 15 : 17} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

// --- AddButton --------------------------------------------------------------

type AddButtonProps = {
  qty?: number;
  onAdd: () => void;
  onChange: (qty: number) => void;
  label: string;
};

/**
 * Morphing add control: a single accent "+" that becomes a stepper once the
 * product is in the cart. Keeps the grid tidy at any cart size.
 */
export function AddButton({ qty, onAdd, onChange, label }: AddButtonProps) {
  if (qty && qty > 0) {
    return <QtyStepper qty={qty} onChange={onChange} label={label} size="sm" />;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${label} to cart`}
      onPress={onAdd}
      style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
    >
      <AppIcon name="add" size={19} color={colors.onPrimary} />
    </Pressable>
  );
}

// --- StoreCard --------------------------------------------------------------

type StoreCardProps = {
  merchant: Merchant;
  onPress: () => void;
};

/** Marketplace store row: mark, name, tagline, category + town. */
export function StoreCard({ merchant, onPress }: StoreCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${merchant.name}, ${KIND_LABEL[merchant.kind]}, ${merchant.town}`}
      onPress={onPress}
      style={({ pressed }) => [styles.storeCard, pressed && styles.cardPressed]}
    >
      <View style={[styles.storeMark, { backgroundColor: tileColor(merchant.name) }]}>
        <Text style={styles.storeLetter}>{merchant.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.storeInfo}>
        <Text style={styles.storeName} numberOfLines={1}>
          {merchant.name}
        </Text>
        <Text style={styles.storeTagline} numberOfLines={1}>
          {merchant.tagline}
        </Text>
        <View style={styles.storeMeta}>
          <Badge label={KIND_LABEL[merchant.kind]} status="neutral" />
          <View style={styles.townRow}>
            <AppIcon name="pin" size={12} color={colors.faint} />
            <Text style={styles.townText}>{merchant.town}</Text>
          </View>
        </View>
      </View>
      <AppIcon name="chevronRight" size={16} color={colors.faint} />
    </Pressable>
  );
}

// --- StoreRailCard ----------------------------------------------------------

/** Compact horizontal-rail variant used on the Home screen. */
export function StoreRailCard({ merchant, onPress }: StoreCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${merchant.name}, ${KIND_LABEL[merchant.kind]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.railCard, pressed && styles.cardPressed]}
    >
      <View style={[styles.railMark, { backgroundColor: tileColor(merchant.name) }]}>
        <Text style={styles.railLetter}>{merchant.name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.railName} numberOfLines={1}>
        {merchant.name}
      </Text>
      <Text style={styles.railMeta} numberOfLines={1}>
        {merchant.town}
      </Text>
    </Pressable>
  );
}

// --- ProductGridCard --------------------------------------------------------

type ProductGridCardProps = {
  product: Product;
  onOpen: () => void;
};

/** Two-column marketplace tile: media on top, name/price/add below. */
export function ProductGridCard({ product, onOpen }: ProductGridCardProps) {
  const { lines, add, setQty } = useCart();
  const inCart = lines.find((l) => l.productId === product.id);
  const soldOut = product.stock === 0;
  const low = !soldOut && product.stock <= 10;

  return (
    <View style={styles.gridCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${product.name}, ${peso(product.price)}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.gridMedia, pressed && styles.pressed]}
      >
        <ProductTile
          name={product.name}
          photoUrl={product.photoUrl}
          style={styles.gridImage}
        />
        {soldOut ? (
          <View style={styles.soldOutVeil}>
            <Text style={styles.soldOutText}>Sold out</Text>
          </View>
        ) : low ? (
          <View style={styles.lowStockPill}>
            <Text style={styles.lowStockText}>{product.stock} left</Text>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.gridBody}>
        <Text style={styles.gridName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.gridUnit} numberOfLines={1}>
          per {product.unit}
        </Text>
        <View style={styles.gridFoot}>
          <Text style={styles.gridPrice} numberOfLines={1}>
            {peso(product.price)}
          </Text>
          {soldOut ? (
            <View style={styles.addDisabled}>
              <AppIcon name="close" size={15} color={colors.faint} />
            </View>
          ) : (
            <AddButton
              qty={inCart?.qty}
              onAdd={() => add(product, 1)}
              onChange={(q) => setQty(product.id, q)}
              label={product.name}
            />
          )}
        </View>
      </View>
    </View>
  );
}

// --- ProductSheet ------------------------------------------------------------

type ProductSheetProps = {
  product: Product | null;
  onClose: () => void;
};

/** Product detail sheet opened by tapping a grid tile. */
export function ProductSheet({ product, onClose }: ProductSheetProps) {
  const { lines, add, setQty } = useCart();
  const inCart = product ? lines.find((l) => l.productId === product.id) : undefined;
  if (!product) return null;

  const soldOut = product.stock === 0;

  return (
    <SheetModal visible={Boolean(product)} onClose={onClose} title={product.name} subtitle={product.unit}>
      <View style={styles.sheetMedia}>
        <ProductTile name={product.name} photoUrl={product.photoUrl} style={styles.sheetImage} />
      </View>

      <View style={styles.sheetPriceRow}>
        <Text style={styles.sheetPrice}>{peso(product.price)}</Text>
        <Text style={styles.sheetUnit}>per {product.unit}</Text>
      </View>

      {product.description ? <Text style={styles.sheetDesc}>{product.description}</Text> : null}

      <View style={styles.sheetMetaRow}>
        <Badge
          label={soldOut ? 'Sold out' : `${product.stock} in stock`}
          status={soldOut ? 'danger' : product.stock <= 10 ? 'pending' : 'success'}
        />
        <Badge label={product.categoryLabel} status="neutral" />
      </View>

      {soldOut ? (
        <Button title="Sold out" disabled fullWidth onPress={onClose} />
      ) : inCart && inCart.qty > 0 ? (
        <View style={styles.sheetStepperRow}>
          <Text style={styles.sheetStepperLabel}>In your cart</Text>
          <QtyStepper qty={inCart.qty} onChange={(q) => setQty(product.id, q)} label={product.name} />
        </View>
      ) : (
        <Button
          title={`Add to cart · ${peso(product.price)}`}
          variant="accent"
          onPress={() => {
            add(product, 1);
            onClose();
          }}
        />
      )}
    </SheetModal>
  );
}

// --- CartBar ----------------------------------------------------------------

/** Persistent bottom bar: item count, subtotal, and a proceed action. */
export function CartBar({ onPress, actionLabel = 'Go to cart' }: { onPress: () => void; actionLabel?: string }) {
  const { count, subtotal } = useCart();
  if (count === 0) return null;
  return (
    <View style={[styles.cartBar, shadows.sticky]}>
      <View style={styles.cartCount}>
        <AppIcon name="cart" size={17} color={colors.onAccent} />
        <Text style={styles.cartCountText}>{count}</Text>
      </View>
      <View style={styles.cartInfo}>
        <Text style={styles.cartSubtotal}>{peso(subtotal)}</Text>
        <Text style={styles.cartCaption}>
          {count} item{count === 1 ? '' : 's'} · delivery calculated at checkout
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel}, ${count} items, ${peso(subtotal)}`}
        onPress={onPress}
        style={({ pressed }) => [styles.cartCta, pressed && styles.pressed]}
      >
        <Text style={styles.cartCtaText}>{actionLabel}</Text>
        <AppIcon name="chevronRight" size={15} color={colors.onAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // ProductTile
  tile: { alignItems: 'center', justifyContent: 'center' },
  tileLetter: { color: '#FFFFFF', fontWeight: '700' },
  tileLetterFluid: { fontSize: 44 },

  // QtyStepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperSm: { gap: 0 },
  stepSm: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepMd: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepQty: { ...typography.subhead, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  stepQtySm: { ...typography.label, minWidth: 20 },

  // AddButton
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDisabled: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // StoreCard
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  storeMark: { width: 58, height: 58, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  storeLetter: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  storeInfo: { flex: 1, gap: 3 },
  storeName: { ...typography.subhead, fontWeight: '700' },
  storeTagline: { ...typography.caption },
  storeMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 },
  townRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  townText: { ...typography.caption },

  // StoreRailCard
  railCard: {
    width: 132,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 3,
  },
  railMark: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  railLetter: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  railName: { ...typography.label },
  railMeta: { ...typography.caption },

  // ProductGridCard
  gridCard: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  gridMedia: { position: 'relative' },
  gridImage: { width: '100%', aspectRatio: 1, borderRadius: 0, backgroundColor: 'transparent' },
  soldOutVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutText: { ...typography.label, color: colors.body },
  lowStockPill: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.warn,
  },
  lowStockText: { ...typography.micro, fontSize: 10, color: '#FFFFFF' },
  gridBody: { padding: spacing.md, gap: 2 },
  gridName: { ...typography.subhead, fontSize: 14, lineHeight: 19 },
  gridUnit: { ...typography.caption, fontSize: 11.5 },
  gridFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  gridPrice: { ...typography.price, fontSize: 16, flexShrink: 1 },

  // ProductSheet
  sheetMedia: { alignItems: 'center' },
  sheetImage: { width: 190, aspectRatio: 1 },
  sheetPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  sheetPrice: { ...typography.price, fontSize: 22 },
  sheetUnit: { ...typography.caption },
  sheetDesc: { ...typography.body, color: colors.muted },
  sheetMetaRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  sheetStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  sheetStepperLabel: { ...typography.label },

  // CartBar
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  cartCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  cartCountText: { ...typography.micro, color: colors.onAccent },
  cartInfo: { flex: 1, gap: 1 },
  cartSubtotal: { ...typography.price, fontSize: 16 },
  cartCaption: { ...typography.caption, fontSize: 11 },
  cartCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  cartCtaText: { ...typography.label, color: colors.onAccent },

  // Shared
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  pressed: { opacity: 0.7 },
});
