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
import { canChat, type MessageRow } from '../messaging/chat';
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
      setOtherName(name || (o.customer_id === profile?.id ? 'Your rider' : 'Customer'));
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

  return (
    <Screen
      scroll={false}
      footer={<BottomNav />}
      footerHeight={BOTTOM_NAV_HEIGHT}
      contentStyle={styles.fill}
    >
      <ScreenHeader
        title={order ? `#${order.order_number} · ${otherName}` : otherName}
        subtitle={order ? order.status.replace(/_/g, ' ') : undefined}
        onBack={() => navigation.goBack()}
      />
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
            <EmptyState
              title="Say hello"
              message={
                chatOpen
                  ? 'Coordinate pickup, landmarks, or item swaps with each other here.'
                  : 'No messages in this order yet — the chat opens once a rider is on the way.'
              }
              icon="chat"
            />
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === profile?.id;
              return (
                <View key={m.id} style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.body}</Text>
                    <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            })
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
              style={({ pressed }) => [styles.send, (!draft.trim() || sending) && styles.sendDisabled, pressed && styles.pressed]}
            >
              <AppIcon name="send" size={19} color={colors.onPrimary} />
            </Pressable>
          </View>
        ) : (
          <Card variant="tinted" style={styles.closed}>
            <Text style={styles.closedText}>Chat closed — this order is {order?.status.replace(/_/g, ' ')}.</Text>
          </Card>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

export function ChatSkeleton() {
  return (
    <View style={{ gap: spacing.sm }}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} width={`${70 - i * 10}%`} height={44} borderRadius={radius.lg} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  thread: { flex: 1 },
  threadContent: { gap: spacing.sm, paddingBottom: spacing.sm, flexGrow: 1 },
  row: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, gap: 2 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, borderBottomLeftRadius: radius.sm },
  bubbleText: { ...typography.body, color: colors.text },
  bubbleTextMine: { color: colors.onPrimary },
  bubbleTime: { ...typography.micro, fontSize: 10, color: colors.faint, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 110,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...typography.body,
    color: colors.text,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
  closed: { padding: spacing.base },
  closedText: { ...typography.caption, textAlign: 'center' },
  pressed: { opacity: 0.75 },
});
