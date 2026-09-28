import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { useAuth } from '@isla/supabase';
import {
  AppIcon,
  Badge,
  Card,
  EmptyState,
  Screen,
  Skeleton,
  colors,
  spacing,
  typography,
} from '@isla/ui';
import { useConversations } from '../messaging/chat';
import type { RootNavProp, TabScreen } from '../navigation/types';

type Props = TabScreen<'Messages'>;

export function useUnreadMessagesCount(): number {
  const { conversations } = useConversations('customer');
  return conversations.filter((c) => c.unread).length;
}

export default function MessagesScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { client, profile } = useAuth();
  const { conversations, loading, refresh } = useConversations('customer');
  const [riderNames, setRiderNames] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

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

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>
          {loading ? 'Loading…' : conversations.length ? `${conversations.length} conversation${conversations.length === 1 ? '' : 's'}` : 'Rider chats live here'}
        </Text>
      </View>

      {loading ? (
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
      ) : conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          message="Once a rider accepts your order, you can coordinate pickup and delivery here in real time."
          icon="message"
        />
      ) : (
        <View style={styles.list}>
          {conversations.map(({ order, lastMessage, unread }) => (
            <Card
              key={order.id}
              variant="flat"
              style={styles.card}
              onPress={() => navigation.navigate('Chat', { orderId: order.id })}
            >
              <View style={styles.avatar}>
                <AppIcon name="rider" size={22} color={colors.primaryDeep} />
              </View>
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
              {unread ? <View style={styles.dot} /> : null}
              {order.status === 'completed' ? <Badge label="Done" status="delivered" /> : null}
            </Card>
          ))}
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
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
