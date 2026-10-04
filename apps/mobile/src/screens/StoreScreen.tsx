import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@isla/supabase';
import { CACHE_TTLS, cacheKey } from '../lib/cache';
import { useCachedQuery } from '../lib/useCachedQuery';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Screen,
  ScreenHeader,
  SectionHeader,
  TextField,
  colors,
  spacing,
  typography,
} from '@isla/ui';
import {
  KIND_LABEL,
  fetchMerchant,
  type Merchant,
} from '../marketplace/data';
import { CartBar, QtyStepper } from '../marketplace/components';
import { useCart } from '../marketplace/cart';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import { goToTab, type RootNavProp, type RootStackScreen } from '../navigation/types';

type Props = RootStackScreen<'Store'>;

export default function StoreScreen({ route }: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { merchantId } = route.params;
  const { client } = useAuth();

  // Cache-first store header (10-min), offline fallback.
  const {
    data: merchant,
    loading,
    error: queryError,
    refresh: refreshMerchant,
  } = useCachedQuery<Merchant | null>(
    cacheKey('merchant', merchantId),
    () => fetchMerchant(client, merchantId),
    { ttlMs: CACHE_TTLS.merchant, persist: true },
  );
  const error = queryError
    ? queryError.message
    : !loading && !merchant
      ? 'This store is no longer available.'
      : null;

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

      <StoreListComposer merchantId={merchant.id} merchantName={merchant.name} />
    </Screen>
  );
}

/**
 * Free-text order lines for a store. Lines land in the shared cart with no
 * price; the store confirms each price when packing.
 */
function StoreListComposer({ merchantId, merchantName }: { merchantId: string; merchantName: string }) {
  const { lines, addCustom, setQty, remove } = useCart();
  const [text, setText] = useState('');
  const [qty, setQtyLocal] = useState(1);

  const mine = lines.filter((l) => l.merchantId === merchantId && l.custom);

  const submit = () => {
    if (!text.trim()) return;
    addCustom(merchantId, text, qty);
    setText('');
    setQtyLocal(1);
  };

  return (
    <Card variant="flat">
      <SectionHeader title="Ano ang ipabibili mo?" />
      <Text style={styles.composerBody}>
        Write what you need from {merchantName}. The store sets the price when packing.
      </Text>
      <TextField
        placeholder="e.g. 1 kilong bigas, 2 itlog"
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      <View style={styles.composerRow}>
        <QtyStepper qty={qty} onChange={setQtyLocal} label="Quantity" />
        <Button title="Add item" variant="secondary" onPress={submit} />
      </View>
      {mine.map((l) => (
        <View key={l.productId} style={styles.customRow}>
          <Text style={styles.customName} numberOfLines={1}>
            {l.qty}× {l.name}
          </Text>
          <QtyStepper qty={l.qty} onChange={(q) => setQty(l.productId, q)} label={l.name} size="sm" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${l.name}`}
            onPress={() => remove(l.productId)}
            hitSlop={8}
          >
            <Text style={styles.customRemove}>Remove</Text>
          </Pressable>
        </View>
      ))}
    </Card>
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

  composerBody: { ...typography.caption, color: colors.muted },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  customName: { ...typography.body, flex: 1, fontWeight: '600' },
  customRemove: { ...typography.label, color: colors.danger },

  errorActions: { gap: spacing.sm, width: '100%' },
  footerStack: { gap: spacing.sm },
});
