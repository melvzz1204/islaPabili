import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
import { ChatComposer, ChatThread } from '../messaging/ChatThread';
import {
  fetchStoreThread,
  sendStoreMessage,
  useStoreThreadRealtime,
  type StoreMessageRow,
} from '../messaging/storeChat';
import { fetchMerchant } from '../marketplace/data';
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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(viewerIsMerchant ? otherName : storeName).charAt(0).toUpperCase() || 'S'}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>
              {viewerIsMerchant ? otherName : storeName}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              Ask before ordering · no order yet
            </Text>
          </View>
          <View style={styles.orderChip}>
            <Text style={styles.orderChipText} numberOfLines={1}>
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
            <ChatThread messages={messages} myId={profile?.id ?? ''} />
          )}
        </ScrollView>

        <ChatComposer onSend={(body) => send(body)} sending={sending} placeholder={`Message ${viewerIsMerchant ? 'customer' : storeName}…`} />
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
