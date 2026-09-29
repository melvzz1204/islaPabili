import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
import { canChat, type MessageRow } from '../messaging/chat';
import type { RootNavProp, RootStackScreen } from '../navigation/types';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type Props = RootStackScreen<'Chat'>;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

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
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadOrder = useCallback(async () => {
    const { data } = await client.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (!data) return;
    const o = data as OrderRow;
    setOrder(o);
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

  const loadMessages = useCallback(async () => {
    const { data } = await client
      .from('order_messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
      .limit(200);
    setMessages((data ?? []) as MessageRow[]);
  }, [client, orderId]);

  useEffect(() => {
    void loadOrder();
    void loadMessages();
  }, [loadOrder, loadMessages]);

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
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
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

  const send = async () => {
    const body = draft.trim();
    if (!body || !profile || sending) return;
    if (order && !canChat(order.status)) {
      showToast({ message: 'This chat is closed — the order is no longer active.', type: 'info' });
      return;
    }
    setSending(true);
    const { error } = await client.from('order_messages').insert({
      order_id: orderId,
      sender_id: profile.id,
      body: body.slice(0, 2000),
    });
    setSending(false);
    if (error) {
      showToast({ message: error.message, type: 'error' });
      return;
    }
    setDraft('');
    await loadMessages();
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
                  : 'No messages in this order yet — the chat opens once a rider is on the way.'}
              </Text>
              {order ? (
                <View style={styles.emptyChip}>
                  <Text style={styles.emptyChipText}>Order #{order.order_number}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Thread messages={messages} myId={profile?.id ?? ''} />
          )}
        </ScrollView>

        {chatOpen ? (
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message…"
              placeholderTextColor={colors.faint}
              multiline
              maxLength={2000}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={() => void send()}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              onPress={() => void send()}
              disabled={!draft.trim() || sending}
              style={({ pressed }) => [
                styles.send,
                !draft.trim() && styles.sendIdle,
                sending && styles.sendDisabled,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon name="send" size={19} color={colors.onPrimary} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.closed}>
            <AppIcon name="lock" size={15} color={colors.muted} />
            <Text style={styles.closedText}>Chat closed — this order is {order?.status.replace(/_/g, ' ')}.</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Day dividers + grouped bubbles with tails, ticks and inline timestamps. */
function Thread({ messages, myId }: { messages: MessageRow[]; myId: string }) {
  let lastDay = '';
  return (
    <>
      {messages.map((m, i) => {
        const day = dayLabel(m.created_at);
        const showDay = day !== lastDay;
        lastDay = day;
        const mine = m.sender_id === myId;
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const groupedPrev = !!prev && prev.sender_id === m.sender_id && +new Date(m.created_at) - +new Date(prev.created_at) < 5 * 60 * 1000;
        const groupedNext = !!next && next.sender_id === m.sender_id && +new Date(next.created_at) - +new Date(m.created_at) < 5 * 60 * 1000;
        return (
          <View key={m.id}>
            {showDay ? (
              <View style={styles.dayRow}>
                <View style={styles.dayPill}>
                  <Text style={styles.dayText}>{day}</Text>
                </View>
              </View>
            ) : null}
            <View
              style={[
                styles.row,
                mine ? styles.rowMine : styles.rowTheirs,
                groupedPrev ? styles.rowGrouped : styles.rowFresh,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  mine ? styles.bubbleMine : styles.bubbleTheirs,
                  mine && !groupedNext && styles.tailMine,
                  !mine && !groupedNext && styles.tailTheirs,
                ]}
              >
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.body}</Text>
                {!groupedNext ? (
                  <View style={styles.metaRow}>
                    <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{clock(m.created_at)}</Text>
                    {mine ? <AppIcon name="check" size={12} color="rgba(255,255,255,0.8)" /> : null}
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </>
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
  dayRow: { alignItems: 'center', marginVertical: spacing.sm },
  dayPill: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    ...shadows.card,
  },
  dayText: { ...typography.micro, color: colors.muted, fontWeight: '700' },
  row: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  rowFresh: { marginTop: spacing.sm },
  rowGrouped: { marginTop: 3 },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    gap: 3,
  },
  bubbleMine: { backgroundColor: colors.primaryDeep, ...shadows.card },
  bubbleTheirs: { backgroundColor: colors.surface, ...shadows.card },
  tailMine: { borderBottomRightRadius: radius.xs },
  tailTheirs: { borderBottomLeftRadius: radius.xs },
  bubbleText: { ...typography.body, color: colors.text },
  bubbleTextMine: { color: colors.onPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  bubbleTime: { ...typography.micro, fontSize: 10, color: colors.faint },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },

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
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.sm,
    paddingLeft: spacing.base,
    ...shadows.raised,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    paddingVertical: spacing.xs,
    ...typography.body,
    color: colors.text,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  sendIdle: { backgroundColor: colors.primary },
  sendDisabled: { opacity: 0.5 },
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
