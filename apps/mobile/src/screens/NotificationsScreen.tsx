import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth, type Database } from '@isla/supabase';
import { useAuthMode } from '../lib/authMode';
import { CACHE_TTLS, cacheKey, invalidate, peekEntry, readPersistedEntry, setEntry } from '../lib/cache';
import { useCachedQuery } from '../lib/useCachedQuery';
import {
  Button,
  Card,
  EmptyState,
  Screen,
  ScreenHeader,
  SheetModal,
  Skeleton,
  colors,
  radius,
  spacing,
  typography,
  useToast,
} from '@isla/ui';
import type { RootNavProp, RootStackScreen } from '../navigation/types';
import { goToTab } from '../navigation/types';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';

type Notification = Database['public']['Tables']['notifications']['Row'];
type Props = RootStackScreen<'Notifications'>;

export function useUnreadCount(): number {
  const { client, session } = useAuth();
  const [unread, setUnread] = useState(0);
  const uid = session?.user.id ?? null;
  const countKey = uid ? cacheKey('notifications-unread', uid) : null;

  const refresh = useCallback(
    async (force = false) => {
      if (!uid || !countKey) {
        setUnread(0);
        return;
      }
      if (!force) {
        const peeked = peekEntry<number>(countKey);
        if (peeked) {
          setUnread(peeked.value);
          if (peeked.fresh) return;
        } else {
          const stored = await readPersistedEntry<number>(countKey);
          if (stored) {
            setUnread(stored.value);
            if (stored.fresh) return;
          }
        }
      }
      try {
        // Chat messages (kind 'message') live in the message badges, not the
        // bell, the bell counts order updates, promos, and review results.
        // kind is nullable (pre-0020 rows), so nulls must pass explicitly.
        const { count } = await client
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('is_read', false)
          .or('kind.neq.message,kind.is.null');
        const next = count ?? 0;
        setUnread(next);
        setEntry(countKey, next, CACHE_TTLS.unreadCount, true);
      } catch {
        // Offline: keep cached badge.
      }
    },
    [client, uid, countKey],
  );

  // Per-hook suffix: client.channel() reuses the instance for an identical
  // topic and realtime-js throws on `.on()` after `.subscribe()`, so
  // concurrent mounts must never share a topic.
  const instanceId = useMemo(() => Math.random().toString(36).slice(2, 9), []);

  useEffect(() => {
    if (!uid) {
      setUnread(0);
      return;
    }
    void refresh();
    const channel = client
      .channel(`notifications-ping-${uid}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => {
          void refresh(true);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => {
          void refresh(true);
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => {
          void refresh(true);
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, uid, refresh, instanceId]);

  // Realtime DELETE/UPDATE events can be missed on flaky sockets, which used
  // to leave a stale badge forever. Re-read on every focus so the bell always
  // converges to the true count when the user returns to the screen.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return unread;
}

export default function NotificationsScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { client, session } = useAuth();
  const { showToast } = useToast();
  const { mode } = useAuthMode();
  // The rider shell has no customer tabs: no BottomNav footer there, and
  // taps land back on the rider dashboard (threads live in its Messages tab).
  // Same for the merchant shell: no Tabs route, so no BottomNav and taps land
  // on the merchant dashboard (its Orders tab holds the order).
  const isRider = mode === 'rider';
  const isMerchant = mode === 'merchant';
  const noTabs = isRider || isMerchant;
  const uid = session?.user.id ?? null;

  // Cache-first inbox (30s TTL, offline fallback).
  const {
    data: itemsData,
    loading,
    refresh,
  } = useCachedQuery<Notification[]>(
    uid ? cacheKey('notifications', uid) : null,
    async () => {
      const { data: userData } = await client.auth.getUser();
      const id = userData.user?.id ?? uid;
      if (!id) return [];
      const { data, error } = await client
        .from('notifications')
        .select('*')
        .eq('user_id', id)
        .or('kind.neq.message,kind.is.null')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as Notification[];
    },
    { ttlMs: CACHE_TTLS.notifications, persist: true, enabled: !!uid },
  );
  const items = itemsData ?? [];
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const hasUnread = items.some((n) => !n.is_read);

  /** Permanently delete every notification for this user (both roles). */
  const clearAll = async () => {
    const { data: userData } = await client.auth.getUser();
    const id = userData.user?.id ?? uid;
    if (!id || clearing) return;
    setClearing(true);
    const { error } = await client.from('notifications').delete().eq('user_id', id);
    setClearing(false);
    if (error) {
      showToast({ message: error.message, type: 'error' });
      return;
    }
    setConfirmClear(false);
    // Detach both caches so the list empties and every badge drops to zero;
    // the badge hook re-reads on the realtime DELETE event (forced refresh).
    // Also write 0 through optimistically: if the realtime event is missed,
    // the next non-forced badge read still sees zero instead of stale data.
    invalidate(cacheKey('notifications', id));
    invalidate(cacheKey('notifications-unread', id));
    setEntry(cacheKey('notifications-unread', id), 0, CACHE_TTLS.unreadCount, true);
    await refresh();
    showToast({ message: 'Notifications cleared.', type: 'success' });
  };

  // Refresh every time the inbox is opened, and live while it stays open ,
  // otherwise a notification that lands (e.g. the rider-application receipt)
  // only appears after a manual reload.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const listInstanceId = useMemo(() => Math.random().toString(36).slice(2, 9), []);

  useEffect(() => {
    if (!uid) return;
    const channel = client
      .channel(`notifications-list-${listInstanceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        void refresh();
      })
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, refresh, listInstanceId, uid]);

  const markAllRead = async () => {
    const { data: userData } = await client.auth.getUser();
    const id = userData.user?.id ?? uid;
    if (!id) return;
    const { error } = await client.from('notifications').update({ is_read: true }).eq('user_id', id).eq('is_read', false);
    if (error) {
      showToast({ message: error.message, type: 'error' });
      return;
    }
    if (uid) {
      invalidate(cacheKey('notifications-unread', uid));
      setEntry(cacheKey('notifications-unread', uid), 0, CACHE_TTLS.unreadCount, true);
    }
    await refresh();
  };

  const openItem = async (n: Notification) => {
    if (!n.is_read) {
      await client.from('notifications').update({ is_read: true }).eq('id', n.id);
      if (uid) invalidate(cacheKey('notifications-unread', uid));
      await refresh();
    }
    if (isRider) {
      // No Chat/Orders routes in the rider shell: everything lands back on
      // the dashboard, where the Messages tab badge marks the unread thread
      // and Requests holds pabili broadcasts.
      navigation.navigate('Rider');
      return;
    }
    if (isMerchant) {
      // No Tabs/Orders/Rider routes in the merchant shell: order updates
      // land on the dashboard Orders tab; everything else (inquiries via
      // message badges, review results) lands on the overview.
      navigation.navigate('Merchant', n.order_id ? { tab: 'orders' as const } : undefined);
      return;
    }
    // Message notifications deep-link straight into the order chat.
    if (n.kind === 'message' && n.order_id) {
      navigation.navigate('Chat', { orderId: n.order_id });
      return;
    }
    // Pre-order store inquiries (no order): customers jump to the store
    // thread. (Merchant mode returns to the dashboard above; message rows
    // are excluded from this inbox, chats live in the message badges.)
    if (n.kind === 'message' && !n.order_id && n.merchant_id) {
      navigation.navigate('StoreChat', { merchantId: n.merchant_id });
      return;
    }
    // Store-application updates (no order): the apply/status gate lives in
    // the merchant shell, so from a customer session just mark read and
    // point the way (merchant/rider modes returned to their dashboards above).
    if (n.kind === 'merchant_application') {
      showToast({ message: 'Log out and sign in as a merchant to open your store.', type: 'info' });
      return;
    }
    // Rider-application notifications land on the rider gate (status screen);
    // rows written before 0020 have no kind, so fall back to title matching.
    // Pabili broadcasts (kind pabili, no order) also land on the Rider tab,
    // where the rider accepts them; customer pabili updates carry an order_id
    // and land on Orders below.
    const isRiderItem =
      n.kind === 'rider_application' ||
      (n.kind === 'pabili' && !n.order_id) ||
      n.title === 'Application received' ||
      n.title.startsWith('Rider application');
    if (isRiderItem) {
      navigation.navigate('Rider');
    } else if (n.order_id) {
      goToTab(navigation, 'Orders');
    }
  };

  return (
    <Screen footer={noTabs ? undefined : <BottomNav />} footerHeight={noTabs ? 0 : BOTTOM_NAV_HEIGHT}>
      <ScreenHeader
        title="Notifications"
        onBack={() => navigation.goBack()}
        right={
          items.length > 0 ? (
            <View style={styles.headerActions}>
              {hasUnread ? (
                <Button
                  title="Mark all read"
                  variant="ghost"
                  size="md"
                  onPress={() => void markAllRead()}
                />
              ) : null}
              <Button
                title="Clear"
                variant="ghost"
                size="md"
                onPress={() => setConfirmClear(true)}
              />
            </View>
          ) : undefined
        }
      />
      <SheetModal
        visible={confirmClear}
        title="Clear notifications?"
        subtitle="This permanently removes every notification in your inbox. New updates will still arrive afterwards."
        onClose={() => setConfirmClear(false)}
        footer={
          <View style={styles.confirmFoot}>
            <View style={styles.confirmFlex}>
              <Button title="Keep them" variant="secondary" disabled={clearing} onPress={() => setConfirmClear(false)} />
            </View>
            <View style={styles.confirmFlex}>
              <Button title="Clear all" variant="danger" loading={clearing} onPress={() => void clearAll()} />
            </View>
          </View>
        }
      >
        <Text style={styles.confirmBody}>
          {items.length} notification{items.length === 1 ? '' : 's'}
          {hasUnread ? ` (${items.filter((n) => !n.is_read).length} unread)` : ''} will be deleted. This cannot be undone.
        </Text>
      </SheetModal>
      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={40} height={40} borderRadius={radius.pill} />
              <View style={styles.skeletonBody}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="90%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          title="All caught up"
          message={
            isRider
              ? 'Pabili broadcasts, order updates and application results will appear here.'
              : isMerchant
                ? 'New orders, order updates and review results will appear here.'
                : 'Order updates from your stores and riders will appear here.'
          }
          icon="bell"
          action={
            noTabs ? undefined : (
              <Button title="Browse stores" onPress={() => goToTab(navigation, 'Shop')} />
            )
          }
        />
      ) : (
        <View style={styles.list}>
          {items.map((n) => (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              accessibilityLabel={n.title}
              onPress={() => void openItem(n)}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Card variant={n.is_read ? 'flat' : 'tinted'} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.cardHeadText}>
                    <Text style={styles.title} numberOfLines={1}>
                      {n.title}
                    </Text>
                    <Text style={styles.time}>{new Date(n.created_at).toLocaleString()}</Text>
                  </View>
                  {!n.is_read ? <View style={styles.dot} /> : null}
                </View>
                <Text style={styles.body}>{n.body}</Text>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  skeletonRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  skeletonBody: { flex: 1, gap: 7 },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  confirmFoot: { flexDirection: 'row', gap: spacing.sm },
  confirmFlex: { flex: 1 },
  confirmBody: { ...typography.body },
  card: { gap: 4, padding: spacing.base },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardHeadText: { flex: 1, gap: 1 },
  dot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.primary, marginTop: 5 },
  title: { ...typography.subhead, fontWeight: '700' },
  body: { ...typography.body, color: colors.muted },
  time: { ...typography.micro, color: colors.faint },
  pressed: { opacity: 0.7 },
});
