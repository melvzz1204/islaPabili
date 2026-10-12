import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useAuth } from '@isla/supabase';
import {
  AppIcon,
  Screen,
  colors,
  radius,
  shadows,
  spacing,
  typography,
  useToast,
} from '@isla/ui';
import { ChatComposer, ChatThread, conversationColor } from '../messaging/ChatThread';
import {
  fetchStoreThread,
  sendStoreMessage,
  setOpenStoreThread,
  useStoreThreadRealtime,
  type StoreMessageRow,
} from '../messaging/storeChat';
import { fetchMerchant } from '../marketplace/data';
import { invokeInquiryPush } from '../lib/push';
import { fetchStorePresence, fetchUserPresence, markStoreThreadRead, presenceLabel, type Presence } from '../messaging/chat';
import { useAuthMode } from '../lib/authMode';
import { BottomNav } from '../components/BottomNav';
import type { RootNavProp, RootStackScreen } from '../navigation/types';

type Props = RootStackScreen<'StoreChat'>;

/**
 * Pre-order inquiry thread: customer <-> store owners without an order.
 * Merchant side passes customerId explicitly; customer side defaults to self.
 */
export default function StoreChatScreen({ route }: Props) {
  const { merchantId, customerId } = route.params;
  const navigation = useNavigation<RootNavProp>();
  const { client, profile } = useAuth();
  const { mode } = useAuthMode();
  const { showToast } = useToast();
  const [storeName, setStoreName] = useState('Store');
  const [otherName, setOtherName] = useState('Chat');
  const [messages, setMessages] = useState<StoreMessageRow[]>([]);
  const [sending, setSending] = useState(false);

  const threadCustomerId = customerId ?? profile?.id ?? '';
  const viewerIsMerchant = mode === 'merchant';
  // Per-conversation Messenger accent, stable for this merchant+customer pair.
  const accent = useMemo(() => conversationColor(`${merchantId}:${threadCustomerId}`), [merchantId, threadCustomerId]);
  // Counterpart presence: the customer (merchant view) or the store's owners
  // (customer view). Falls back to the static subtitle when unknown.
  const [presence, setPresence] = useState<Presence | null>(null);
  useEffect(() => {
    let active = true;
    const refreshPresence = async () => {
      const lastActive = viewerIsMerchant
        ? threadCustomerId
          ? await fetchUserPresence(client, threadCustomerId)
          : null
        : await fetchStorePresence(client, merchantId);
      if (active) setPresence(lastActive ? presenceLabel(lastActive) : null);
    };
    void refreshPresence();
    const timer = setInterval(() => {
      void refreshPresence();
    }, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [client, merchantId, threadCustomerId, viewerIsMerchant]);

  const load = useCallback(async () => {
    if (!threadCustomerId) return;
    try {
      const rows = await fetchStoreThread(client, merchantId, threadCustomerId);
      setMessages(rows);
    } catch {
      // Offline: keep what is on screen.
    }
  }, [client, merchantId, threadCustomerId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Banner suppression: the merchant shell stays quiet for the open thread.
  useEffect(() => {
    if (!threadCustomerId) return;
    setOpenStoreThread(`${merchantId}:${threadCustomerId}`);
    return () => setOpenStoreThread(null);
  }, [merchantId, threadCustomerId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const m = await fetchMerchant(client, merchantId);
        if (active && m) setStoreName(m.name);
      } catch {
        // Keep fallback name.
      }
      // Header counterpart: merchant sees the customer, customer sees store.
      if (viewerIsMerchant && threadCustomerId) {
        const { data } = await client.from('profiles').select('full_name').eq('id', threadCustomerId).maybeSingle();
        if (active) setOtherName(((data as { full_name?: string } | null)?.full_name?.trim()) || 'Customer');
      } else {
        if (active) setOtherName(storeName);
      }
    })();
    return () => {
      active = false;
    };
  }, [client, merchantId, threadCustomerId, viewerIsMerchant, storeName]);

  const onInsert = useCallback((row: StoreMessageRow) => {
    setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
  }, []);
  useStoreThreadRealtime(client, merchantId, threadCustomerId, onInsert);

  // Clear-on-view: everything visible counts as read, so badges drop the
  // moment the thread is seen (including live arrivals while reading). The
  // matching bell rows are marked read too.
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused || messages.length === 0 || !profile) return;
    const latest = messages[messages.length - 1];
    if (!latest?.created_at) return;
    markStoreThreadRead(merchantId, latest.created_at);
    void client
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('kind', 'message')
      .eq('merchant_id', merchantId)
      .eq('is_read', false);
  }, [focused, messages, merchantId, client, profile]);

  const send = async (body: string) => {
    const text = body.trim();
    if (!text || !profile || sending || !threadCustomerId) return;
    setSending(true);
    try {
      await sendStoreMessage(client, {
        merchantId,
        customerId: threadCustomerId,
        senderId: profile.id,
        body: text,
      });
      // Wake the other side when their app is killed/backgrounded.
      void invokeInquiryPush(client, { merchantId, customerId: threadCustomerId });
      await load();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Could not send.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen scroll={false} keyboard={false} background={colors.chatCanvas} contentStyle={styles.fill}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
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
          <View style={[styles.avatar, { backgroundColor: accent.main }]}>
            <Text style={styles.avatarText}>{(viewerIsMerchant ? otherName : storeName).charAt(0).toUpperCase() || 'S'}</Text>
            {presence ? (
              <View style={[styles.presenceDot, presence.online && styles.presenceOnline]} />
            ) : null}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>
              {viewerIsMerchant ? otherName : storeName}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {presence ? presence.text : 'Ask before ordering · no order yet'}
            </Text>
          </View>
          <View style={[styles.orderChip, { backgroundColor: accent.soft }]}>
            <Text style={[styles.orderChipText, { color: accent.deep }]} numberOfLines={1}>
              Inquiry
            </Text>
          </View>
        </View>

        <ScrollView style={styles.thread} contentContainerStyle={styles.threadContent} keyboardShouldPersistTaps="handled">
          {messages.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <AppIcon name="chat" size={30} color={colors.primaryDeep} />
              </View>
              <Text style={styles.emptyTitle}>Ask the store first</Text>
              <Text style={styles.emptyBody}>
                Check stock, price, or availability with {storeName} before you order. They usually reply in the app.
              </Text>
            </View>
          ) : (
            <ChatThread
              messages={messages}
              myId={profile?.id ?? ''}
              accent={accent}
              theirInitial={(viewerIsMerchant ? otherName : storeName).charAt(0) || 'S'}
            />
          )}
        </ScrollView>

        <ChatComposer onSend={(body) => send(body)} sending={sending} placeholder={`Message ${viewerIsMerchant ? 'customer' : storeName}…`} accent={accent} />
        {mode === 'merchant' ? null : <BottomNav />}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
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
  thread: { flex: 1 },
  threadContent: { paddingBottom: spacing.sm, paddingTop: spacing.xs, flexGrow: 1 },
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
  pressed: { opacity: 0.7 },
});
