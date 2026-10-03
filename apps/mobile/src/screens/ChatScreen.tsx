import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useAuth, type Database } from '@isla/supabase';
import {
  AppIcon,
  EmptyState,
  Screen,
  colors,
  radius,
  shadows,
  spacing,
  typography,
  useToast,
} from '@isla/ui';
import { canChat, markConversationRead, setOpenOrderId, type MessageRow } from '../messaging/chat';
import { ChatComposer, ChatThread } from '../messaging/ChatThread';
import { invokePush } from '../lib/push';
import { CACHE_TTLS, cacheKey, peekEntry, readPersistedEntry, setEntry } from '../lib/cache';
import type { RootNavProp, RootStackScreen } from '../navigation/types';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type Props = RootStackScreen<'Chat'>;

export default function ChatScreen({ route }: Props) {
  const { orderId } = route.params;
  const navigation = useNavigation<RootNavProp>();
  const { client, profile } = useAuth();
  const { showToast } = useToast();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [otherName, setOtherName] = useState('Chat');
  const [otherInitial, setOtherInitial] = useState('C');
  const [presence, setPresence] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadOrder = useCallback(async () => {
    // Cache-first header so reopening a thread is instant/offline.
    const key = cacheKey('order', orderId);
    const peeked = peekEntry<OrderRow>(key);
    const applyOrder = (o: OrderRow) => setOrder(o);
    if (peeked) applyOrder(peeked.value);
    else {
      const stored = await readPersistedEntry<OrderRow>(key);
      if (stored) applyOrder(stored.value);
    }
    const { data } = await client.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (!data) return;
    const o = data as OrderRow;
    applyOrder(o);
    setEntry(key, o, CACHE_TTLS.orders, true);
    const otherId = o.customer_id === profile?.id ? o.rider_id : o.customer_id;
    if (otherId) {
      const { data: person } = await client.from('profiles').select('full_name').eq('id', otherId).maybeSingle();
      const name = (person as { full_name?: string } | null)?.full_name?.trim();
      const fallback = o.customer_id === profile?.id ? 'Your rider' : 'Customer';
      setOtherName(name || fallback);
      setOtherInitial((name || fallback).charAt(0).toUpperCase() || 'C');
      // Presence: show whether the rider is on duty right now.
      if (o.customer_id === profile?.id && o.rider_id) {
        const { data: status } = await client
          .from('rider_status')
          .select('on_duty')
          .eq('rider_id', o.rider_id)
          .maybeSingle();
        const onDuty = (status as { on_duty?: boolean } | null)?.on_duty;
        setPresence(onDuty ? 'Online now' : 'Away');
      } else {
        setPresence(null);
      }
    }
  }, [client, orderId, profile?.id]);

  const loadMessages = useCallback(
    async (force = false) => {
      const key = cacheKey('messages', orderId);
      if (!force) {
        const peeked = peekEntry<MessageRow[]>(key);
        if (peeked) setMessages(peeked.value);
        else {
          const stored = await readPersistedEntry<MessageRow[]>(key);
          if (stored) setMessages(stored.value);
        }
        if (peeked?.fresh) return;
      }
      try {
        const { data } = await client
          .from('order_messages')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true })
          .limit(200);
        const rows = (data ?? []) as MessageRow[];
        setMessages(rows);
        setEntry(key, rows, CACHE_TTLS.messages, true);
      } catch {
        // Offline: keep cached thread visible.
      }
    },
    [client, orderId],
  );

  useEffect(() => {
    void loadOrder();
    void loadMessages();
  }, [loadOrder, loadMessages]);

  // Mute the global message banner while this thread is on screen.
  useEffect(() => {
    setOpenOrderId(orderId);
    return () => setOpenOrderId(null);
  }, [orderId]);

  // Clear-on-view: everything visible in this open thread counts as read, so
  // the Messages tab badge drops the moment the thread is seen (including
  // messages that arrive live while reading).
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused || messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (latest?.created_at) markConversationRead(orderId, latest.created_at);
  }, [focused, messages, orderId]);

  // Per-mount suffix: concurrent mounts must never share a realtime topic
  // (realtime-js throws on `.on()` after `.subscribe()` for the same topic).
  const instanceId = useMemo(() => Math.random().toString(36).slice(2, 9), []);

  useEffect(() => {
    const channel = client
      .channel(`chat-${orderId}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_id=eq.${orderId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            const next = [...prev, row];
            setEntry(cacheKey('messages', orderId), next, CACHE_TTLS.messages, true);
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, orderId, instanceId]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const send = async (body: string) => {
    const text = body.trim();
    if (!text || !profile || sending) return;
    if (order && !canChat(order.status)) {
      showToast({ message: 'This chat is closed, the order is no longer active.', type: 'info' });
      return;
    }
    setSending(true);
    const { error } = await client.from('order_messages').insert({
      order_id: orderId,
      sender_id: profile.id,
      body: text.slice(0, 2000),
    });
    setSending(false);
    if (error) {
      showToast({ message: error.message, type: 'error' });
      return;
    }
    // Wake the other side when their app is killed/backgrounded.
    void invokePush(client, orderId, 'message');
    await loadMessages(true);
  };

  const chatOpen = order ? canChat(order.status) : true;
  const online = presence === 'Online now';

  return (
    <Screen
      scroll={false}
      footer={<BottomNav />}
      footerHeight={BOTTOM_NAV_HEIGHT}
      background={colors.chatCanvas}
      contentStyle={styles.fill}
    >
      {/* Premium header: back · avatar + presence · order chip · track */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <AppIcon name="back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{otherInitial}</Text>
          {chatOpen ? <View style={[styles.presenceDot, online && styles.presenceOnline]} /> : null}
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerName} numberOfLines={1}>
            {otherName}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {chatOpen ? (presence ?? 'Active now') : `Chat closed · ${order?.status.replace(/_/g, ' ') ?? ''}`}
          </Text>
        </View>
        {order ? (
          <View style={styles.orderChip}>
            <Text style={styles.orderChipText} numberOfLines={1}>
              #{order.order_number}
            </Text>
          </View>
        ) : null}
        {order?.rider_id ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Track on map"
            onPress={() => navigation.navigate('Track', { orderId })}
            hitSlop={8}
            style={({ pressed }) => [styles.trackBtn, pressed && styles.pressed]}
          >
            <AppIcon name="route" size={19} color={colors.onPrimary} />
          </Pressable>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <AppIcon name="chat" size={30} color={colors.primaryDeep} />
              </View>
              <Text style={styles.emptyTitle}>Say hello</Text>
              <Text style={styles.emptyBody}>
                {chatOpen
                  ? 'Coordinate pickup, landmarks, or item swaps with each other here.'
                  : 'No messages in this order yet, the chat opens once a rider is on the way.'}
              </Text>
              {order ? (
                <View style={styles.emptyChip}>
                  <Text style={styles.emptyChipText}>Order #{order.order_number}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <ChatThread messages={messages} myId={profile?.id ?? ''} />
          )}
        </ScrollView>

        {chatOpen ? (
          <ChatComposer onSend={(body) => send(body)} sending={sending} />
        ) : (
          <View style={styles.closed}>
            <AppIcon name="lock" size={15} color={colors.muted} />
            <Text style={styles.closedText}>Chat closed, this order is {order?.status.replace(/_/g, ' ')}.</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

export function ChatEmptyFallback() {
  return <EmptyState title="Say hello" message="Coordinate pickup and delivery here." icon="chat" />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...shadows.card,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.heading, color: colors.onPrimary },
  presenceDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.faint,
    borderWidth: 2.5,
    borderColor: colors.surface,
  },
  presenceOnline: { backgroundColor: colors.success },
  headerText: { flex: 1, gap: 0 },
  headerName: { ...typography.subhead, fontWeight: '700' },
  headerSub: { ...typography.micro, color: colors.muted },
  orderChip: {
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    maxWidth: 120,
  },
  orderChipText: { ...typography.micro, color: colors.primaryDeep, fontWeight: '700' },
  trackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },

  // Thread
  thread: { flex: 1 },
  threadContent: { paddingBottom: spacing.sm, paddingTop: spacing.xs, flexGrow: 1 },

  // Empty thread
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.raised,
  },
  emptyTitle: { ...typography.title, fontSize: 20 },
  emptyBody: { ...typography.body, textAlign: 'center' },
  emptyChip: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  emptyChipText: { ...typography.micro, color: colors.primaryDeep, fontWeight: '700' },

  // Composer
  closed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
  },
  closedText: { ...typography.caption, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
