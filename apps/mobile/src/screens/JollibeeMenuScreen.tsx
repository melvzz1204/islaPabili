import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@isla/supabase';
import {
  Badge,
  Button,
  Chip,
  ChipRow,
  EmptyState,
  Screen,
  ScreenHeader,
  SearchBar,
  SectionHeader,
  SkeletonProductTile,
  radius,
  spacing,
  typography,
} from '@isla/ui';
import {
  JOLLIBEE_MERCHANT_ID,
  KIND_LABEL,
  categoriesOf,
  fetchMerchant,
  fetchProducts,
  searchProducts,
  type Merchant,
  type Product,
} from '../marketplace/data';
import { CartBar, ProductGridCard, ProductSheet } from '../marketplace/components';
import { useCart } from '../marketplace/cart';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import { goToTab, type RootNavProp, type RootStackScreen } from '../navigation/types';

type Props = RootStackScreen<'JollibeeMenu'>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/jollibee.png');

export default function JollibeeMenuScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { client } = useAuth();
  const { lines } = useCart();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [all, setAll] = useState<Product[]>([]);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, products] = await Promise.all([
        fetchMerchant(client, JOLLIBEE_MERCHANT_ID),
        fetchProducts(client, JOLLIBEE_MERCHANT_ID),
      ]);
      setMerchant(m);
      setAll(products);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load the Jollibee menu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void Promise.all([
      fetchMerchant(client, JOLLIBEE_MERCHANT_ID),
      fetchProducts(client, JOLLIBEE_MERCHANT_ID),
    ])
      .then(([m, products]) => {
        if (!active) return;
        setMerchant(m);
        setAll(products);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load the Jollibee menu.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client]);

  const cats = useMemo(() => categoriesOf(all), [all]);

  const products = useMemo(() => {
    const base = searchProducts(all, query);
    return categoryId ? base.filter((p) => p.categoryId === categoryId) : base;
  }, [all, query, categoryId]);

  const goShop = () => goToTab(navigation, 'Shop');

  /** Fallback: send what's in the cart (or a blank list) as a rider pabili errand. */
  const orderViaPabili = () => {
    const mine = lines.filter((l) => l.merchantId === JOLLIBEE_MERCHANT_ID);
    navigation.navigate('PabiliCreate', {
      store: merchant?.name ?? 'Jollibee',
      items: mine.map((l) => ({ name: l.name, qty: String(l.qty) })),
    });
  };

  if (loading) {
    return (
      <Screen
        edges={['top']}
        footer={
          <View style={styles.footerStack}>
            <CartBar onPress={() => navigation.navigate('Cart')} actionLabel="View cart" />
            <BottomNav />
          </View>
        }
        footerHeight={88 + BOTTOM_NAV_HEIGHT}
      >
        <View style={styles.brandCard}>
          <Image source={LOGO} style={styles.logo} accessibilityLabel="Jollibee logo" />
          <View style={styles.brandText}>
            <Text style={styles.brandTitle}>Jollibee</Text>
            <Text style={styles.brandSub}>Loading the menu…</Text>
          </View>
        </View>
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonProductTile key={i} />
          ))}
        </View>
      </Screen>
    );
  }

  if (error || !merchant) {
    return (
      <Screen edges={['top']} footer={<BottomNav />} footerHeight={BOTTOM_NAV_HEIGHT}>
        <ScreenHeader title="Jollibee" onBack={() => navigation.goBack()} />
        <EmptyState
          title="Could not load the Jollibee menu"
          message={error ?? 'Jollibee is not available right now.'}
          icon="warning"
          action={
            <View style={styles.errorActions}>
              <Button title="Try again" onPress={() => void load()} />
              <Button title="Back to shop" variant="secondary" onPress={goShop} />
            </View>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      edges={['top']}
      footer={
        <View style={styles.footerStack}>
          <CartBar onPress={() => navigation.navigate('Cart')} actionLabel="View cart" />
          <BottomNav />
        </View>
      }
      footerHeight={88 + BOTTOM_NAV_HEIGHT}
    >
      <ScreenHeader
        title={merchant.name}
        subtitle={`${KIND_LABEL[merchant.kind]} · ${merchant.town}`}
        onBack={() => navigation.goBack()}
        right={<Badge label="Open" status="success" dot />}
      />

      {/* Brand header with the logo from assets */}
      <View style={styles.brandCard}>
        <Image source={LOGO} style={styles.logo} accessibilityLabel="Jollibee logo" />
        <View style={styles.brandText}>
          <Text style={styles.brandTitle}>Bida ang saya</Text>
          <Text style={styles.brandSub}>
            Live menu, prices and stock update with the store. Add to cart and check out.
          </Text>
        </View>
      </View>

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder={`Search ${merchant.name}`}
        accessibilityLabel={`Search products in ${merchant.name}`}
      />

      <ChipRow>
        <Chip label="All" selected={categoryId === undefined} onPress={() => setCategoryId(undefined)} />
        {cats.map((c) => (
          <Chip
            key={c.id}
            label={c.label}
            selected={categoryId === c.id}
            onPress={() => setCategoryId(categoryId === c.id ? undefined : c.id)}
          />
        ))}
      </ChipRow>

      {/* Grid */}
      {all.length === 0 ? (
        <EmptyState
          title="No products yet"
          message={`${merchant.name} hasn't listed anything yet. Check back soon, or send a pabili list instead.`}
          icon="package"
          action={<Button title="Send a pabili list" variant="secondary" onPress={orderViaPabili} />}
        />
      ) : products.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          message="Try a different search term or pick another category."
          icon="search"
          action={
            <Button
              title="Reset"
              variant="secondary"
              onPress={() => {
                setQuery('');
                setCategoryId(undefined);
              }}
            />
          }
        />
      ) : (
        <>
          <SectionHeader title={`${products.length} item${products.length === 1 ? '' : 's'}`} />
          <View style={styles.grid}>
            {products.map((p) => (
              <View key={p.id} style={styles.gridCell}>
                <ProductGridCard product={p} onOpen={() => setSelected(p)} />
              </View>
            ))}
          </View>
        </>
      )}

      {/* Pabili fallback, a rider buys it when the item isn't listed */}
      <View style={styles.pabiliCard}>
        <Text style={styles.pabiliTitle}>Can&apos;t find what you crave?</Text>
        <Text style={styles.pabiliBody}>
          Send it as a pabili errand and a rider will buy it at the {merchant.name} counter for you.
        </Text>
        <Button title="Order via Pabili instead" variant="secondary" onPress={orderViaPabili} />
      </View>

      <ProductSheet product={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#D8232A',
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
  },
  brandText: { flex: 1, gap: 2 },
  brandTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  brandSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12.5, lineHeight: 17 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridCell: { width: '48.2%', flexGrow: 1 },

  pabiliCard: { gap: spacing.sm, marginTop: spacing.md },
  pabiliTitle: { ...typography.subhead, fontWeight: '700' },
  pabiliBody: { ...typography.caption },

  errorActions: { gap: spacing.sm, alignSelf: 'stretch' },
  footerStack: { gap: spacing.sm },
});
