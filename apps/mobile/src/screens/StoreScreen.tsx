import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@isla/supabase';
import { CACHE_TTLS, cacheKey } from '../lib/cache';
import { useCachedQuery } from '../lib/useCachedQuery';
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
  colors,
  spacing,
} from '@isla/ui';
import {
  KIND_LABEL,
  categoriesOf,
  fetchMerchant,
  fetchProducts,
  searchProducts,
  type Merchant,
  type Product,
} from '../marketplace/data';
import { CartBar, ProductGridCard, ProductSheet } from '../marketplace/components';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import { goToTab, type RootNavProp, type RootStackScreen } from '../navigation/types';

type Props = RootStackScreen<'Store'>;
type Sort = 'popular' | 'priceAsc' | 'priceDesc' | 'name';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'priceAsc', label: 'Price low to high' },
  { value: 'priceDesc', label: 'Price high to low' },
  { value: 'name', label: 'A to Z' },
];

export default function StoreScreen({ route }: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { merchantId } = route.params;
  const { client } = useAuth();
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('popular');
  const [selected, setSelected] = useState<Product | null>(null);

  // Cache-first: store header (10-min) + product list (5-min), offline fallback.
  const {
    data: merchant,
    loading: merchantLoading,
    error: merchantError,
    refresh: refreshMerchant,
  } = useCachedQuery<Merchant | null>(
    cacheKey('merchant', merchantId),
    () => fetchMerchant(client, merchantId),
    { ttlMs: CACHE_TTLS.merchant, persist: true },
  );
  const {
    data: productsData,
    loading: productsLoading,
    error: productsError,
    refresh: refreshProducts,
  } = useCachedQuery<Product[]>(
    cacheKey('products', merchantId),
    () => fetchProducts(client, merchantId),
    { ttlMs: CACHE_TTLS.products, persist: true },
  );
  const all = productsData ?? [];
  const loading = merchantLoading || productsLoading;
  const queryError = merchantError ?? productsError;
  const error = queryError
    ? queryError.message
    : !loading && !merchant
      ? 'This store is no longer available.'
      : null;

  const cats = useMemo(() => categoriesOf(all), [all]);

  const products = useMemo(() => {
    const base = searchProducts(all, query);
    const inCat = categoryId ? base.filter((p) => p.categoryId === categoryId) : base;
    const sorted = [...inCat];
    if (sort === 'priceAsc') sorted.sort((a, b) => a.price - b.price);
    if (sort === 'priceDesc') sorted.sort((a, b) => b.price - a.price);
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [all, query, categoryId, sort]);

  const goShop = () => goToTab(navigation, 'Shop');

  // --- States ---------------------------------------------------------------

  if (loading) {
    return (
      <Screen
        edges={['top']}
        footer={
          <View style={styles.footerStack}>
            <CartBar onPress={() => navigation.navigate('Cart')} />
            <BottomNav />
          </View>
        }
        footerHeight={88 + BOTTOM_NAV_HEIGHT}
      >
        <StoreSkeletonHeader />
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
        <EmptyState
          title="Could not load this store"
          message={error ?? 'This store is no longer available.'}
          icon="warning"
          action={
            <View style={styles.errorActions}>
              <Button
                title="Try again"
                onPress={() => {
                  void refreshMerchant();
                  void refreshProducts();
                }}
              />
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
      <ScreenHeader title={merchant.name} subtitle={`${KIND_LABEL[merchant.kind]} · ${merchant.town}`} onBack={() => navigation.goBack()} right={<Badge label="Open" status="success" dot />} />

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

      {/* Sort */}
      <View style={styles.sortRow} accessibilityRole="tablist" accessibilityLabel="Sort products">
        {SORTS.map((s) => (
          <Button
            key={s.value}
            title={s.label}
            size="md"
            variant={sort === s.value ? 'soft' : 'ghost'}
            onPress={() => setSort(s.value)}
            style={styles.sortBtn}
          />
        ))}
      </View>

      {/* Grid */}
      {all.length === 0 ? (
        <EmptyState
          title="No products yet"
          message={`${merchant.name} hasn't listed anything yet. Check back soon.`}
          icon="package"
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

      <ProductSheet product={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

function StoreSkeletonHeader() {
  return (
    <View style={styles.head}>
      <View style={styles.headText}>
        <View style={styles.skelTitle} />
        <View style={styles.skelSub} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  skelTitle: { height: 24, width: '55%', borderRadius: 8, backgroundColor: colors.skeleton },
  skelSub: { height: 13, width: '35%', borderRadius: 6, backgroundColor: colors.skeleton },

  sortRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  sortBtn: { paddingHorizontal: spacing.md },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridCell: { width: '48.2%', flexGrow: 1 },

  errorActions: { gap: spacing.sm, width: '100%' },
  footerStack: { gap: spacing.sm },
});
