import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth, type Database } from '@isla/supabase';
import {
  AppIcon,
  Card,
  EmptyState,
  Screen,
  ScreenHeader,
  colors,
  radius,
  spacing,
  typography,
  useToast,
} from '@isla/ui';
import { OrderMap, MARINDUQUE_CENTER, type LatLng } from '../maps/OrderMap';
import { formatDistance, haversineKm } from '../lib/geo';
import type { RootNavProp, RootStackScreen } from '../navigation/types';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type RiderStatus = Database['public']['Tables']['rider_status']['Row'];
type Props = RootStackScreen<'Track'>;

export default function TrackScreen({ route }: Props) {
  const { orderId } = route.params;
  const navigation = useNavigation<RootNavProp>();
  const { client } = useAuth();
  const { showToast } = useToast();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [riderLive, setRiderLive] = useState<LatLng | null>(null);
  const [riderName, setRiderName] = useState('Your rider');
  const [riderPhone, setRiderPhone] = useState<string | null>(null);

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

  return (
    <Screen scroll={false} footer={<BottomNav />} footerHeight={BOTTOM_NAV_HEIGHT} contentStyle={styles.fill}>
      <ScreenHeader
        title={order ? `Tracking #${order.order_number}` : 'Tracking'}
        subtitle={order ? order.status.replace(/_/g, ' ') : undefined}
        onBack={() => navigation.goBack()}
      />
      {!order ? (
        <EmptyState title="Loading order…" message="Fetching the latest delivery position." icon="route" />
      ) : !order.rider_id ? (
        <EmptyState
          title="No rider yet"
          message="Live tracking starts as soon as a rider accepts your order."
          icon="rider"
        />
      ) : (
        <>
          <Card variant="tinted" style={styles.statusCard}>
            <View style={styles.riderIcon}>
              <AppIcon name="rider" size={22} color={colors.primaryDeep} />
            </View>
            <View style={styles.statusText}>
              <Text style={styles.riderName} numberOfLines={1}>
                {riderName}
              </Text>
              <Text style={styles.statusSub} numberOfLines={1}>
                {distance ? `${distance} away · ` : ''}{order.status.replace(/_/g, ' ')}
              </Text>
            </View>
          </Card>
          <View style={styles.mapBox}>
            <OrderMap
              self={dropoff ?? MARINDUQUE_CENTER}
              selfLabel="Drop-off"
              other={riderLive}
              otherLabel={riderName}
              onMessagePress={() => navigation.navigate('Chat', { orderId })}
              onCallPress={callRider}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  riderIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: { flex: 1, gap: 1 },
  riderName: { ...typography.subhead, fontWeight: '700' },
  statusSub: { ...typography.caption, textTransform: 'capitalize' },
  mapBox: { flex: 1, borderRadius: radius.lg, overflow: 'hidden' },
});
