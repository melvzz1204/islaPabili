import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { useAuth } from '@isla/supabase';
import {
  Badge,
  Card,
  EmptyState,
  Screen,
  Skeleton,
  colors,
  spacing,
  typography,
} from '@isla/ui';
import { useConversations, resolveStoreChatTarget } from '../messaging/chat';
import { ThreadAvatar, conversationColor } from '../messaging/ChatThread';
import {
  applyStoreRead,
  toStoreConversations,
  useReadTick,
  useUnreadStoreCount,
  type StoreConversation,
  type StoreMessageRow,
} from '../messaging/storeChat';
import type { RootNavProp, TabScreen } from '../navigation/types';

type Props = TabScreen<'Messages'>;

export function useUnreadMessagesCount(): number {
  const { conversations } = useConversations('customer');
  const storeUnread = useUnreadStoreCount();
  return conversations.filter((c) => c.unread).length + storeUnread;
}

export default function MessagesScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { client, profile } = useAuth();
  const { conversations, loading, refresh } = useConversations('customer');
  const readTick = useReadTick();
  const [riderNames, setRiderNames] = useState<Record<string, string>>({});
  const [storeRows, setStoreRows] = useState<StoreMessageRow[]>([]);
  const [storeNames, setStoreNames] = useState<Record<string, string>>({});
  const [storeLoading, setStoreLoading] = useState(true);

  const loadStores = useCallback(
    async (force = false) => {
      if (!profile) {
        setStoreLoading(false);
        return;
      }
      if (!force) setStoreLoading(true);
      try {
        const { data, error } = await client
          .from('store_messages')
          .select('*')
          .eq('customer_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as StoreMessageRow[];
        setStoreRows(rows);
        const ids = [...new Set(rows.map((r) => r.merchant_id))];
        if (ids.length > 0) {
          const { data: merchants } = await client.from('merchants').select('id, name').in('id', ids);
          const map: Record<string, string> = {};
          for (const m of (merchants ?? []) as { id: string; name: string }[]) map[m.id] = m.name;
          setStoreNames(map);
        }
      } catch {
        // Offline: keep stale rows.
      } finally {
        setStoreLoading(false);
      }
    },
    [client, profile],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void loadStores(true);
    }, [refresh, loadStores]),
  );

  const storeInstanceId = useMemo(() => Math.random().toString(36).slice(2, 9), []);
  useEffect(() => {
    if (!profile) return;
    const channel = client
      .channel(`messages-stores-${profile.id}-${storeInstanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'store_messages', filter: `customer_id=eq.${profile.id}` },
        () => void loadStores(true),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, profile, loadStores, storeInstanceId]);

  const storeConversations: StoreConversation[] = useMemo(() => {
    if (!profile) return [];
    return applyStoreRead(toStoreConversations(storeRows, profile.id, storeNames, { counterpart: 'merchant' }));
  }, [storeRows, storeNames, profile, readTick]);

  useEffect(() => {
    const ids = [...new Set(conversations.map((c) => c.order.rider_id).filter(Boolean))] as string[];
    if (ids.length === 0) return;
    let active = true;
    void (async () => {
      const { data } = await client.from('profiles').select('id, full_name').in('id', ids);
      if (!active) return;
      const map: Record<string, string> = {};
      for (const row of (data ?? []) as { id: string; full_name: string }[]) {
        map[row.id] = row.full_name?.trim() || 'Your rider';
      }
      setRiderNames(map);
    })();
    return () => {
      active = false;
    };
  }, [client, conversations]);

  const totalCount = conversations.length + storeConversations.length;
  const busy = loading || storeLoading;

  // One live thread per store: an active order chat wins over the inquiry.
  const openStoreThread = async (merchantId: string) => {
    const target = await resolveStoreChatTarget(client, { merchantId, customerId: profile?.id });
    if (target.route === 'Chat') navigation.navigate('Chat', { orderId: target.orderId });
    else navigation.navigate('StoreChat', { merchantId: target.merchantId });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>
          {busy ? 'Loading…' : totalCount ? `${totalCount} conversation${totalCount === 1 ? '' : 's'}` : 'Rider + store chats live here'}
        </Text>
      </View>

      {busy ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={46} height={46} borderRadius={23} />
              <View style={styles.skeletonBody}>
                <Skeleton width="40%" height={15} />
                <Skeleton width="85%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : totalCount === 0 ? (
        <EmptyState
          title="No conversations yet"
          message="Ask a store about stock or price before ordering, or coordinate delivery with your rider here once an order is on the way."
          icon="message"
        />
      ) : (
        <View style={styles.list}>
          {storeConversations.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Store inquiries · no order yet</Text>
              {storeConversations.map((c) => (
                <Card
                  key={c.merchantId}
                  variant="flat"
                  style={[styles.card, c.unread && { backgroundColor: conversationColor(c.merchantId).soft }]}
                  onPress={() => void openStoreThread(c.merchantId)}
                >
                  <ThreadAvatar
                    initial={c.merchantName}
                    accent={conversationColor(c.merchantId)}
                    size={46}
                  />
                  <View style={styles.body}>
                    <View style={styles.topRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {c.merchantName}
                      </Text>
                      {c.lastMessage ? (
                        <Text style={styles.time}>
                          {new Date(c.lastMessage.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.orderNo} numberOfLines={1}>
                      PRE-ORDER INQUIRY
                    </Text>
                    <Text style={[styles.preview, c.unread && styles.previewUnread]} numberOfLines={1}>
                      {c.lastMessage
                        ? `${c.lastMessage.sender_id === profile?.id ? 'You: ' : ''}${c.lastMessage.body}`
                        : 'Ask about stock, price, or availability.'}
                    </Text>
                  </View>
                  {c.unread ? <View style={[styles.dot, { backgroundColor: conversationColor(c.merchantId).main }]} /> : null}
                </Card>
              ))}
            </View>
          ) : null}

          {conversations.length > 0 ? (
            <View style={styles.section}>
              {storeConversations.length > 0 ? <Text style={styles.sectionTitle}>Order chats</Text> : null}
              {conversations.map(({ order, lastMessage, unread }) => (
                <Card
                  key={order.id}
                  variant="flat"
                  style={[styles.card, unread && { backgroundColor: conversationColor(order.id).soft }]}
                  onPress={() => navigation.navigate('Chat', { orderId: order.id })}
                >
                  <ThreadAvatar
                    initial={order.rider_id ? (riderNames[order.rider_id] ?? 'Your rider') : '?'}
                    accent={conversationColor(order.id)}
                    size={46}
                  />
                  <View style={styles.body}>
                    <View style={styles.topRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {order.rider_id ? riderNames[order.rider_id] ?? 'Your rider' : 'Finding a rider…'}
                      </Text>
                      {lastMessage ? (
                        <Text style={styles.time}>
                          {new Date(lastMessage.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.orderNo} numberOfLines={1}>
                      #{order.order_number} · {order.status.replace(/_/g, ' ')}
                    </Text>
                    <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
                      {lastMessage
                        ? `${lastMessage.sender_id === profile?.id ? 'You: ' : ''}${lastMessage.body}`
                        : 'Say hello to coordinate delivery.'}
                    </Text>
                  </View>
                  {unread ? <View style={[styles.dot, { backgroundColor: conversationColor(order.id).main }]} /> : null}
                  {order.status === 'completed' ? <Badge label="Done" status="delivered" /> : null}
                </Card>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 1 },
  title: { ...typography.display, fontSize: 27 },
  subtitle: { ...typography.caption },
  list: { gap: spacing.sm },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.label, color: colors.muted, textTransform: 'uppercase' },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  body: { flex: 1, gap: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { ...typography.subhead, fontWeight: '700', flex: 1 },
  time: { ...typography.micro, color: colors.faint },
  orderNo: { ...typography.micro, color: colors.faint, textTransform: 'uppercase' },
  preview: { ...typography.body, color: colors.muted },
  previewUnread: { color: colors.text, fontWeight: '700' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  skeletonRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  skeletonBody: { flex: 1, gap: 7 },
});
