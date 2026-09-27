import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { resolveOptedTowns, shouldFilterTowns, TOWN_LABELS } from '@isla/shared';
import { useAuth } from '@isla/supabase';
import {
  Button,
  Chip,
  ChipRow,
  EmptyState,
  Screen,
  SearchBar,
  SkeletonStoreRow,
  spacing,
  typography,
} from '@isla/ui';
import { fetchMerchants, type Merchant, type MerchantKind } from '../marketplace/data';
import { CartBar, StoreCard } from '../marketplace/components';
import type { RootNavProp, TabScreen } from '../navigation/types';

type Props = TabScreen<'Shop'>;

type Filter = MerchantKind | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'grocery', label: 'Groceries' },
  { value: 'restaurant', label: 'Food' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'retail', label: 'Local shops' },
  { value: 'electronics', label: 'Electronics' },
];

export default function MarketScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { client, session, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Filter>('all');
  // Guests and "All municipalities" shoppers always browse the whole island.
  const [browseAll, setBrowseAll] = useState(false);

  const optedTowns = useMemo(() => resolveOptedTowns(profile), [profile]);
  const townFilterApplies = shouldFilterTowns(optedTowns);
  const activeTowns = townFilterApplies && !browseAll ? optedTowns : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMerchants(await fetchMerchants(client, activeTowns));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load stores.');
    } finally {
      setLoading(false);
    }
  }, [client, activeTowns]);

  useEffect(() => {
    void load();
  }, [load]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merchants.filter(
      (m) =>
        (kind === 'all' || m.kind === kind) &&
        (!q || `${m.name} ${m.town} ${m.tagline}`.toLowerCase().includes(q)),
    );
  }, [merchants, kind, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Merchant[]>();
    for (const m of results) {
      const list = map.get(m.town) ?? [];
      list.push(m);
      map.set(m.town, list);
    }
    return [...map.entries()];
  }, [results]);

  // "No stores" caused purely by the town preference is worth calling out.
  const hiddenByTowns = townFilterApplies && browseAll === false && merchants.length === 0;
  const scopeLabel = !townFilterApplies
    ? 'All municipalities'
    : browseAll
      ? 'All municipalities'
      : optedTowns.length === 1
        ? TOWN_LABELS[optedTowns[0]]
        : `${optedTowns.length} municipalities`;

  return (
    <Screen
      edges={['top']}
      footer={<CartBar onPress={() => navigation.navigate('Cart')} actionLabel="View cart" />}
      footerHeight={88}
    >
      <View style={styles.topRow}>
        <View style={styles.brand}>
          <Text style={styles.brandName}>Shop</Text>
          <Text style={styles.brandSub}>
            {loading
              ? 'Finding stores…'
              : `${merchants.length} store${merchants.length === 1 ? '' : 's'} in ${scopeLabel.toLowerCase()}`}
          </Text>
        </View>
        {session ? null : (
          <Button
            title="Log in"
            variant="soft"
            size="md"
            fullWidth={false}
            onPress={() => navigation.navigate('AuthHome')}
          />
        )}
      </View>

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search stores, items, or towns"
        accessibilityLabel="Search stores"
      />

      {townFilterApplies ? (
        <ChipRow>
          <Chip
            label="My towns"
            selected={!browseAll}
            onPress={() => setBrowseAll(false)}
            count={optedTowns.length}
          />
          <Chip
            label="All municipalities"
            selected={browseAll}
            onPress={() => setBrowseAll(true)}
          />
        </ChipRow>
      ) : null}

      <ChipRow>
        {FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            selected={kind === f.value}
            onPress={() => setKind(f.value)}
          />
        ))}
      </ChipRow>

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonStoreRow key={i} />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          title="Could not load stores"
          message={error}
          icon="warning"
          action={<Button title="Try again" onPress={() => void load()} />}
        />
      ) : results.length === 0 ? (
        hiddenByTowns ? (
          <EmptyState
            title="No stores in your towns yet"
            message={`Nothing is live in ${scopeLabel.toLowerCase()} right now. Browse the rest of Marinduque, or update your municipalities from your profile.`}
            icon="storefront"
            action={
              <Button title="Browse all municipalities" onPress={() => setBrowseAll(true)} />
            }
          />
        ) : (
          <EmptyState
            title={query ? 'No matches' : 'No stores yet'}
            message={
              query
                ? `Nothing matched "${query.trim()}". Try a different word or clear the filters.`
                : 'Merchants are still onboarding. Check back soon.'
            }
            icon="search"
            action={
              query || kind !== 'all' ? (
                <Button
                  title="Clear filters"
                  variant="secondary"
                  onPress={() => {
                    setQuery('');
                    setKind('all');
                  }}
                />
              ) : undefined
            }
          />
        )
      ) : (
        <View style={styles.groups}>
          {grouped.map(([town, list]) => (
            <View key={town} style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={styles.groupTown}>{town}</Text>
                <Text style={styles.groupCount}>
                  {list.length} {list.length === 1 ? 'store' : 'stores'}
                </Text>
              </View>
              <View style={styles.list}>
                {list.map((m) => (
                  <StoreCard
                    key={m.id}
                    merchant={m}
                    onPress={() => navigation.navigate('Store', { merchantId: m.id })}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  brand: { flex: 1, gap: 1 },
  brandName: { ...typography.display, fontSize: 27 },
  brandSub: { ...typography.caption },

  groups: { gap: spacing.lg },
  group: { gap: spacing.sm },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  groupTown: { ...typography.heading, fontSize: 17 },
  groupCount: { ...typography.caption },
  list: { gap: spacing.sm },
});
