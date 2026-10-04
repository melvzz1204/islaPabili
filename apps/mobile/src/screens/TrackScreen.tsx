import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth, type Database } from '@isla/supabase';
import { AppIcon, EmptyState, colors, radius, shadows, spacing, typography, useToast } from '@isla/ui';
import { OrderMap, MARINDUQUE_CENTER, type LatLng, type MapActions } from '../maps/OrderMap';
import { formatDistance, haversineKm } from '../lib/geo';
import { peso } from '../marketplace/data';
import type { RootNavProp, RootStackScreen } from '../navigation/types';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type RiderStatus = Database['public']['Tables']['rider_status']['Row'];
type Props = RootStackScreen<'Track'>;

/**
 * Full-screen live tracking: the map fills the entire display with a
 * floating back/order pill on top, the search bar below it, and a rider
 * bottom sheet (message · call · fit) over the map.
 */
export default function TrackScreen({ route }: Props) {
  const { orderId } = route.params;
  const navigation = useNavigation<RootNavProp>();
  const insets = useSafeAreaInsets();
  const { client } = useAuth();
  const { showToast } = useToast();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [riderLive, setRiderLive] = useState<LatLng | null>(null);
  const [riderName, setRiderName] = useState('Your rider');
  const [riderPhone, setRiderPhone] = useState<string | null>(null);
  const mapActions = useRef<MapActions | null>(null);

  const loadOrder = useCallback(async () => {
    const { data } = await client.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (data) setOrder(data as OrderRow);
  }, [client, orderId]);

  const loadRider = useCallback(
    async (riderId: string) => {
      const [{ data: status }, { data: person }] = await Promise.all([
        client.from('rider_status').select('*').eq('rider_id', riderId).maybeSingle(),
        client.from('profiles').select('full_name, phone').eq('id', riderId).maybeSingle(),
      ]);
      const s = status as RiderStatus | null;
      if (s?.current_lat != null && s?.current_lng != null) {
        setRiderLive({ lat: s.current_lat, lng: s.current_lng });
      }
      const p = person as { full_name?: string; phone?: string | null } | null;
      if (p?.full_name?.trim()) setRiderName(p.full_name.trim());
      setRiderPhone(p?.phone ?? null);
    },
    [client],
  );

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!order?.rider_id) return;
    const riderId = order.rider_id;
    void loadRider(riderId);
    const channel = client
      .channel(`track-rider-${riderId}-${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rider_status', filter: `rider_id=eq.${riderId}` },
        (payload) => {
          const s = payload.new as RiderStatus;
          if (s.current_lat != null && s.current_lng != null) {
            setRiderLive({ lat: s.current_lat, lng: s.current_lng });
          }
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, order?.rider_id, loadRider]);

  const dropoff: LatLng | null = useMemo(() => {
    if (order?.dropoff_lat != null && order?.dropoff_lng != null) {
      return { lat: order.dropoff_lat, lng: order.dropoff_lng };
    }
    return null;
  }, [order]);

  const distance = riderLive && dropoff ? formatDistance(haversineKm(riderLive.lat, riderLive.lng, dropoff.lat, dropoff.lng)) : null;

  const callRider = () => {
    if (!riderPhone) {
      showToast({ message: 'Rider contact number is not available.', type: 'info' });
      return;
    }
    void Linking.openURL(`tel:${riderPhone}`);
  };

  if (!order || !order.rider_id) {
    return (
      <View style={[styles.fill, styles.center, { paddingTop: insets.top }]}>
        <View style={styles.topOverlay}>
          <BackFab onBack={() => navigation.goBack()} />
        </View>
        <EmptyState
          title={!order ? 'Loading order…' : 'No rider yet'}
          message={
            !order
              ? 'Fetching the latest delivery position.'
              : 'Live tracking starts as soon as a rider accepts your order.'
          }
          icon="route"
        />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <OrderMap
        self={dropoff ?? MARINDUQUE_CENTER}
        selfLabel="Drop-off"
        other={riderLive}
        otherLabel={riderName}
        showToolbar={false}
        searchTop={insets.top + 68}
        actionsRef={mapActions}
      />

      {/* Floating top: back + order pill */}
      <View style={[styles.topOverlay, { top: insets.top + 10 }]}>
        <BackFab onBack={() => navigation.goBack()} />
        <View style={styles.orderPill}>
          <View style={styles.liveDot} />
          <Text style={styles.orderPillText} numberOfLines={1}>
            #{order.order_number} · {order.status.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>

      {/* Rider bottom sheet */}
      <View style={[styles.sheet, { bottom: insets.bottom + 14 }]}>
        <View style={styles.riderRow}>
          <View style={styles.riderAvatar}>
            <Text style={styles.riderInitial}>{riderName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.riderText}>
            <Text style={styles.riderName} numberOfLines={1}>
              {riderName}
            </Text>
            <Text style={styles.riderSub} numberOfLines={1}>
              {distance ? `${distance} away · ` : ''}{order.status.replace(/_/g, ' ')}
            </Text>
          </View>
          <View style={styles.etaPill}>
            <AppIcon name="rider" size={15} color={colors.primaryDeep} />
            <Text style={styles.etaText}>{distance ?? '…'}</Text>
          </View>
        </View>
        {order.total_delivery_fee != null ? (
          <Text style={styles.feeLine}>
            Delivery {peso(Number(order.total_delivery_fee))}
            {order.distance_km != null ? ` · ${Number(order.distance_km).toFixed(1)} km from your GPS` : ''} · cash on arrival
          </Text>
        ) : null}
        {order.status === 'ready' && order.claim_code ? (
          <Text style={styles.claimLine}>
            Claim code <Text style={styles.claimCode}>{order.claim_code}</Text>
            {order.fulfillment_mode === 'merchant_pickup' ? ' · show at the counter' : ' · rider shows it at pickup'}
          </Text>
        ) : null}
        <View style={styles.actionRow}>
          <SheetAction label="Message" icon="message" primary onPress={() => navigation.navigate('Chat', { orderId })} />
          <SheetAction label="Call" icon="call" onPress={callRider} />
          <SheetAction label="Fit map" icon="route" onPress={() => mapActions.current?.fit()} />
        </View>
      </View>
    </View>
  );
}

function BackFab({ onBack }: { onBack: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onBack}
      hitSlop={8}
      style={({ pressed }) => [styles.backFab, pressed && styles.pressed]}
    >
      <AppIcon name="back" size={20} color={colors.text} />
    </Pressable>
  );
}

function SheetAction({
  label,
  icon,
  primary,
  onPress,
}: {
  label: string;
  icon: 'message' | 'call' | 'route';
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, primary && styles.actionPrimary, pressed && styles.pressed]}
    >
      <AppIcon name={icon} size={18} color={primary ? colors.onPrimary : colors.primaryDeep} />
      <Text style={[styles.actionLabel, primary && styles.actionLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#e8f0ec' },
  center: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  topOverlay: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backFab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.raised,
  },
  orderPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.base,
    height: 46,
    ...shadows.raised,
  },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success },
  orderPillText: { ...typography.label, fontWeight: '700', textTransform: 'capitalize', flex: 1 },

  sheet: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.base,
    gap: spacing.md,
    ...shadows.sheet,
  },
  riderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  riderAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderInitial: { ...typography.heading, color: colors.onPrimary },
  riderText: { flex: 1, gap: 1 },
  riderName: { ...typography.subhead, fontWeight: '700' },
  riderSub: { ...typography.caption, textTransform: 'capitalize' },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  etaText: { ...typography.micro, color: colors.primaryDeep, fontWeight: '800' },
  feeLine: { ...typography.caption, color: colors.primaryDeep, fontWeight: '700' },
  claimLine: { ...typography.caption, color: colors.primaryDeep },
  claimCode: { fontWeight: '800', letterSpacing: 2 },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  actionPrimary: { backgroundColor: colors.primaryDeep },
  actionLabel: { ...typography.label, fontWeight: '700', color: colors.primaryDeep },
  actionLabelPrimary: { color: colors.onPrimary },
  pressed: { opacity: 0.7 },
});
