import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth, type Database } from '@isla/supabase';
import { CACHE_TTLS, cacheKey, invalidate, peekEntry, readPersistedEntry, setEntry } from '../lib/cache';
import { useCachedQuery } from '../lib/useCachedQuery';
import {
  Button,
  Card,
  EmptyState,
  Screen,
  ScreenHeader,
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
        const { count } = await client
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('is_read', false);
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
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, uid, refresh, instanceId]);

  return unread;
}

export default function NotificationsScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { client, session } = useAuth();
  const { showToast } = useToast();
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
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as Notification[];
    },
    { ttlMs: CACHE_TTLS.notifications, persist: true, enabled: !!uid },
  );
  const items = itemsData ?? [];

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
    const channel = client
      .channel(`notifications-list-${listInstanceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, refresh, listInstanceId]);

  const markAllRead = async () => {
    const { data: userData } = await client.auth.getUser();
    const id = userData.user?.id ?? uid;
    if (!id) return;
    const { error } = await client.from('notifications').update({ is_read: true }).eq('user_id', id).eq('is_read', false);
    if (error) {
      showToast({ message: error.message, type: 'error' });
      return;
    }
    if (uid) invalidate(cacheKey('notifications-unread', uid));
    await refresh();
  };

  const openItem = async (n: Notification) => {
    if (!n.is_read) {
      await client.from('notifications').update({ is_read: true }).eq('id', n.id);
      if (uid) invalidate(cacheKey('notifications-unread', uid));
      await refresh();
    }
    // Message notifications deep-link straight into the order chat.
    if (n.kind === 'message' && n.order_id) {
      navigation.navigate('Chat', { orderId: n.order_id });
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
    <Screen footer={<BottomNav />} footerHeight={BOTTOM_NAV_HEIGHT}>
      <ScreenHeader
        title="Notifications"
        onBack={() => navigation.goBack()}
        right={
          items.some((n) => !n.is_read) ? (
            <Button
              title="Mark all read"
              variant="ghost"
              size="md"
              onPress={() => void markAllRead()}
            />
          ) : undefined
        }
      />
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
          message="Order updates from your stores and riders will appear here."
          icon="bell"
          action={
            <Button title="Browse stores" onPress={() => goToTab(navigation, 'Shop')} />
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

  card: { gap: 4, padding: spacing.base },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardHeadText: { flex: 1, gap: 1 },
  dot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.primary, marginTop: 5 },
  title: { ...typography.subhead, fontWeight: '700' },
  body: { ...typography.body, color: colors.muted },
  time: { ...typography.micro, color: colors.faint },
  pressed: { opacity: 0.7 },
});
