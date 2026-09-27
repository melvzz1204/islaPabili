import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { isAllTowns, resolveOptedTowns, shouldFilterTowns, TOWN_LABELS } from '@isla/shared';
import { useAuth, type Database } from '@isla/supabase';
import {
  AppIcon,
  Badge,
  Card,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  colors,
  radius,
  spacing,
  typography,
  useToast,
  type AppIconName,
} from '@isla/ui';
import { fetchMerchants, peso, type Merchant, type MerchantKind } from '../marketplace/data';
import { StoreRailCard } from '../marketplace/components';
import { useUnreadCount } from './NotificationsScreen';
import type { RootNavProp, TabScreen } from '../navigation/types';

type Props = TabScreen<'Home'>;
type OrderRow = Database['public']['Tables']['orders']['Row'];
type ActiveStatus = Database['public']['Enums']['order_status'];

const CATEGORIES: { kind: MerchantKind; label: string; icon: AppIconName; hint: string }[] = [
  { kind: 'grocery', label: 'Groceries', icon: 'categoryGrocery', hint: 'Pantry staples' },
  { kind: 'restaurant', label: 'Food', icon: 'categoryFood', hint: 'Meals and snacks' },
  { kind: 'pharmacy', label: 'Pharmacy', icon: 'categoryPharmacy', hint: 'Health needs' },
  { kind: 'retail', label: 'Local shops', icon: 'categoryRetail', hint: 'Everything else' },
];

const ACTIVE_STATUSES: ActiveStatus[] = [
  'awaiting_merchant',
  'preparing',
  'ready',
  'pending_dispatch',
  'rider_assigned',
  'items_purchased',
  'in_transit',
];

export default function HomeScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { client, profile } = useAuth();
  const { showToast } = useToast();
  const unread = useUnreadCount();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [activeOrder, setActiveOrder] = useState<OrderRow | null>(null);

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  // Show the opt-in set, not just the delivery town ("All municipalities" when
  // the customer took every town, otherwise the first pick).
  const optedTowns = useMemo(() => resolveOptedTowns(profile), [profile]);
  const townLabel = isAllTowns(optedTowns)
    ? 'All municipalities'
    : optedTowns.length > 0
      ? TOWN_LABELS[optedTowns[0]]
      : 'Marinduque';
  // Guests and "All municipalities" shoppers see every store on the rail.
  const railTowns = shouldFilterTowns(optedTowns) ? optedTowns : undefined;

  const loadStores = useCallback(async () => {
    try {
      setMerchants(await fetchMerchants(client, railTowns));
    } catch {
      showToast({ message: 'Could not load stores.', type: 'error' });
    } finally {
      setLoadingStores(false);
    }
  }, [client, railTowns, showToast]);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  useEffect(() => {
    if (!profile) return;
    let active = true;

    const loadOrder = async () => {
      const { data } = await client
        .from('orders')
        .select('*')
        .eq('customer_id', profile.id)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false })
        .limit(1);
      if (active) setActiveOrder(data?.[0] ?? null);
    };

    void loadOrder();
    const channel = client
      .channel(`home-orders-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${profile.id}` },
        () => void loadOrder(),
      )
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [client, profile]);

  const goShop = () => navigation.navigate('Shop');

  return (
    <Screen>
      {/* Greeting */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>Kamusta,</Text>
          <Text style={styles.name} numberOfLines={1}>
            {firstName}!
          </Text>
          <View style={styles.locationRow}>
            <AppIcon name="pin" size={13} color={colors.faint} />
            <Text style={styles.location} numberOfLines={1}>
              {townLabel}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            icon="bell"
            label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            onPress={() => navigation.navigate('Notifications')}
            tone="soft"
            badge={unread}
          />
        </View>
      </View>

      {/* Search entry point */}
      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Search stores and products"
        onPress={goShop}
        style={({ pressed }) => [styles.searchProxy, pressed && styles.pressed]}
      >
        <AppIcon name="search" size={18} color={colors.faint} />
        <Text style={styles.searchText}>Search stores or products</Text>
        <View style={styles.filterChip}>
          <AppIcon name="filter" size={15} color={colors.primary} />
        </View>
      </Pressable>

      {/* Active order tracking */}
      {activeOrder ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Active order, ${activeOrder.status.replace(/_/g, ' ')}`}
          onPress={() => navigation.navigate('Orders')}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Card variant="tinted" style={styles.activeCard}>
            <View style={styles.activeIcon}>
              <AppIcon name="rider" size={20} color={colors.primaryDeep} />
            </View>
            <View style={styles.activeText}>
              <Text style={styles.activeTitle}>Order in progress</Text>
              <Text style={styles.activeBody}>
                {activeOrder.status.replace(/_/g, ' ')} · {peso(Number(activeOrder.grand_total ?? 0))}
              </Text>
            </View>
            <AppIcon name="chevronRight" size={18} color={colors.primaryDeep} />
          </Card>
        </Pressable>
      ) : null}

      {/* Categories */}
      <View style={styles.section}>
        <SectionHeader title="Shop by category" />
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.kind}
              accessibilityRole="button"
              accessibilityLabel={cat.label}
              onPress={goShop}
              style={({ pressed }) => [styles.category, pressed && styles.pressed]}
            >
              <View style={styles.categoryIcon}>
                <AppIcon name={cat.icon} size={22} color={colors.primaryDeep} />
              </View>
              <View style={styles.categoryText}>
                <Text style={styles.categoryLabel} numberOfLines={1}>
                  {cat.label}
                </Text>
                <Text style={styles.categoryHint} numberOfLines={1}>
                  {cat.hint}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Nearby stores rail */}
      <View style={styles.section}>
        <SectionHeader
          title="Nearby stores"
          subtitle={shouldFilterTowns(optedTowns) ? `In your ${townLabel} areas` : 'Delivering around you'}
          actionLabel="See all"
          onAction={goShop}
        />
        {loadingStores ? (
          <View style={styles.rail}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width={132} height={148} borderRadius={radius.lg} />
            ))}
          </View>
        ) : merchants.length === 0 ? (
          <Card variant="flat" style={styles.noStores}>
            <Text style={styles.noStoresText}>
              {shouldFilterTowns(optedTowns)
                ? `No stores are live in your municipalities yet. See all stores to browse the rest of Marinduque.`
                : 'No stores are live yet. Check back soon — merchants are onboarding now.'}
            </Text>
          </Card>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            style={styles.railScroll}
          >
            {merchants.map((m) => (
              <StoreRailCard
                key={m.id}
                merchant={m}
                onPress={() => navigation.navigate('Store', { merchantId: m.id })}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Rider CTA */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Become a rider"
        onPress={() => navigation.navigate('Rider')}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <Card style={styles.riderCard} variant="flat">
          <View style={styles.riderIcon}>
            <AppIcon name="rider" size={24} color={colors.onPrimary} />
          </View>
          <View style={styles.riderText}>
            <Text style={styles.riderTitle}>Drive & earn</Text>
            <Text style={styles.riderBody}>Rider mode is on the same account. Apply once, go online anytime.</Text>
          </View>
          <Badge label="Earn" status="accent" />
        </Card>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: { flex: 1, gap: 1 },
  greeting: { ...typography.body, color: colors.muted },
  name: { ...typography.display, fontSize: 27 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  location: { ...typography.caption },
  headerActions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs },

  searchProxy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 50,
    paddingHorizontal: spacing.base,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  searchText: { ...typography.body, color: colors.faint, flex: 1 },
  filterChip: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  activeIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeText: { flex: 1, gap: 1 },
  activeTitle: { ...typography.label, color: colors.primaryDeep },
  activeBody: { ...typography.caption, color: colors.primaryDeep, textTransform: 'capitalize' },

  section: { gap: spacing.md },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  category: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: { flex: 1, gap: 1 },
  categoryLabel: { ...typography.label, color: colors.text },
  categoryHint: { ...typography.micro, color: colors.faint },

  railScroll: { marginHorizontal: -spacing.pagePadding },
  rail: { gap: spacing.sm, paddingHorizontal: spacing.pagePadding, paddingVertical: 2 },

  noStores: { padding: spacing.base },
  noStoresText: { ...typography.body, color: colors.muted },

  riderCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  riderIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderText: { flex: 1, gap: 2 },
  riderTitle: { ...typography.subhead, fontWeight: '700' },
  riderBody: { ...typography.caption },

  pressed: { opacity: 0.7 },
});
