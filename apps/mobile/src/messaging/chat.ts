import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, type Database } from '@isla/supabase';
import { useToast } from '@isla/ui';
import { CHANNEL_CHAT, blip, getSoundSettings, notifyLocal } from '../lib/notify';
import { CACHE_TTLS, cacheKey, fetchWithCache, peekEntry, readPersistedEntry } from '../lib/cache';

export type OrderRow = Database['public']['Tables']['orders']['Row'];
export type MessageRow = Database['public']['Tables']['order_messages']['Row'];

export const CHATABLE_STATUSES: OrderRow['status'][] = [
  'rider_assigned',
  'items_purchased',
  'in_transit',
];

export const CONVERSATION_STATUSES: OrderRow['status'][] = [
  ...CHATABLE_STATUSES,
  'completed',
];

export function canChat(status: OrderRow['status']): boolean {
  return (CHATABLE_STATUSES as string[]).includes(status);
}

/**
 * While the store is the active party (confirm/pack/ready), the customer
 * and the store owners share the same thread instead of the rider chat.
 */
export const MERCHANT_CHAT_STATUSES: OrderRow['status'][] = [
  'awaiting_merchant',
  'preparing',
  'ready',
];

export function canStoreChat(status: OrderRow['status']): boolean {
  return (MERCHANT_CHAT_STATUSES as string[]).includes(status);
}

export type Conversation = {
  order: OrderRow;
  lastMessage: MessageRow | null;
  unread: boolean;
};

// --- Read state (clear-on-view) ------------------------------------------------
// `unread` used to stick forever: it only meant "last message isn't mine", so
// opening a thread never cleared its badge. Now every shell records, per
// order, the timestamp of the latest message the user has SEEN; anything
// newer from the other party counts as unread. Persisted per profile so a
// badge cleared on this device stays cleared after a restart.
const READ_KEY = 'isla-chat-read-v1';
let readOwner = '';
let readMap: Record<string, string> = {};
let readLoaded = false;
const readListeners = new Set<() => void>();

async function ensureReadMap(owner: string): Promise<void> {
  if (readLoaded && readOwner === owner) return;
  readOwner = owner;
  readMap = {};
  try {
    const raw = await AsyncStorage.getItem(`${READ_KEY}:${owner}`);
    if (raw) readMap = { ...(JSON.parse(raw) as Record<string, string>) };
  } catch {
    readMap = {};
  }
  readLoaded = true;
  for (const fn of readListeners) fn();
}

/**
 * Mark a thread read up to `atIso` (the latest visible message's
 * `created_at`). All badges recompute instantly, on every mounted shell.
 */
export function markConversationRead(orderId: string, atIso: string): void {
  if (!orderId || !atIso) return;
  if ((readMap[orderId] ?? '') >= atIso) return;
  readMap = { ...readMap, [orderId]: atIso };
  for (const fn of readListeners) fn();
  if (readOwner) {
    void AsyncStorage.setItem(`${READ_KEY}:${readOwner}`, JSON.stringify(readMap)).catch(() => undefined);
  }
}

function applyRead(list: Conversation[]): Conversation[] {
  return list.map((c) => ({
    ...c,
    unread:
      c.unread &&
      !!c.lastMessage &&
      c.lastMessage.created_at > (readMap[c.order.id] ?? ''),
  }));
}

/** Customer + rider shared: orders with a rider attached and their latest message. */
export function useConversations(role: 'customer' | 'rider') {
  const { client, profile } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [readTick, setReadTick] = useState(0);

  // Re-derive badges the moment any thread is marked read (possibly from a
  // different mounted hook instance, e.g. the open ChatScreen).
  useEffect(() => {
    const fn = () => setReadTick((t) => t + 1);
    readListeners.add(fn);
    return () => {
      readListeners.delete(fn);
    };
  }, []);

  const conversations = useMemo(() => applyRead(items), [items, readTick]);

  // Cache-first conversation list (20s TTL, offline fallback).
  const load = useCallback(
    async (force = false) => {
      if (!profile) {
        setLoading(false);
        return;
      }
      await ensureReadMap(profile.id);
      const key = cacheKey('conversations', role, profile.id);
      const fetchNetwork = async (): Promise<Conversation[]> => {
        const field = role === 'customer' ? 'customer_id' : 'rider_id';
        const { data: orders } = await client
          .from('orders')
          .select('*')
          .eq(field, profile.id)
          .not('rider_id', 'is', null)
          .in('status', CONVERSATION_STATUSES)
          .order('created_at', { ascending: false })
          .limit(20);
        const list = (orders ?? []) as OrderRow[];
        if (list.length === 0) return [];
        const ids = list.map((o) => o.id);
        const { data: messages } = await client
          .from('order_messages')
          .select('*')
          .in('order_id', ids)
          .order('created_at', { ascending: false });
        const latest = new Map<string, MessageRow>();
        for (const m of (messages ?? []) as MessageRow[]) {
          if (!latest.has(m.order_id)) latest.set(m.order_id, m);
        }
        return list.map((order) => {
          const last = latest.get(order.id) ?? null;
          return { order, lastMessage: last, unread: !!last && last.sender_id !== profile.id };
        });
      };

      if (!force) {
        const peeked = peekEntry<Conversation[]>(key);
        if (peeked) {
          setItems(peeked.value);
          setLoading(false);
          if (peeked.fresh) return;
        } else {
          const stored = await readPersistedEntry<Conversation[]>(key);
          if (stored) {
            setItems(stored.value);
            setLoading(false);
            if (stored.fresh) return;
          }
        }
      }
      try {
        const value = await fetchWithCache<Conversation[]>(key, fetchNetwork, {
          ttlMs: CACHE_TTLS.conversations,
          persist: true,
          force,
        });
        setItems(value);
      } catch {
        // Offline: keep stale items on screen.
      } finally {
        setLoading(false);
      }
    },
    [client, profile, role],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Live: any new message in my conversations refreshes the list preview.
  // NOTE: the channel name includes a per-hook random suffix. `client.channel()`
  // returns the same instance for an identical topic, and realtime-js throws if
  // `.on()` is called after `.subscribe()`, this hook mounts 2-3x at once
  // (tab badge + header badge + list), so a shared name crashes the app.
  const instanceId = useMemo(() => Math.random().toString(36).slice(2, 9), []);
  useEffect(() => {
    if (!profile) return;
    const channel = client
      .channel(`conversations-${role}-${profile.id}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_messages' },
        () => void load(true),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: role === 'customer' ? `customer_id=eq.${profile.id}` : `rider_id=eq.${profile.id}`,
        },
        () => void load(true),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, profile, role, load, instanceId]);

  return { conversations, loading, refresh: load };
}

/** Badge count: conversations with an unread reply from the other party. */
export function useUnreadMessages(role: 'customer' | 'rider'): number {
  const { conversations } = useConversations(role);
  return conversations.filter((c) => c.unread).length;
}

// --- Live incoming-message banners --------------------------------------------

/** Order thread currently on screen, banners stay quiet for it. */
let openOrderId: string | null = null;

export function setOpenOrderId(orderId: string | null) {
  openOrderId = orderId;
}

/**
 * Mount once per shell (customer tabs, rider home). Pops a toast banner
 * whenever the other party writes in one of my orders, except the thread
 * already open on screen, which updates live on its own.
 */
export function useIncomingMessageAlerts(role: 'customer' | 'rider') {
  const { client, profile } = useAuth();
  const { showToast } = useToast();
  const instanceId = useMemo(() => Math.random().toString(36).slice(2, 9), []);

  useEffect(() => {
    if (!profile) return;
    const channel = client
      .channel(`message-alerts-${role}-${profile.id}-${instanceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_messages' }, (payload) => {
        const row = payload.new as MessageRow;
        if (row.sender_id === profile.id || row.order_id === openOrderId) return;
        void (async () => {
          const { data } = await client
            .from('orders')
            .select('id, order_number, customer_id, rider_id')
            .eq('id', row.order_id)
            .maybeSingle();
          const o = data as { order_number: string; customer_id: string; rider_id: string | null } | null;
          if (!o) return;
          const mine = role === 'customer' ? o.customer_id === profile.id : o.rider_id === profile.id;
          if (!mine) return;
          const { data: person } = await client
            .from('profiles')
            .select('full_name')
            .eq('id', row.sender_id)
            .maybeSingle();
          const name = (person as { full_name?: string } | null)?.full_name?.trim() || 'New message';
          const snippet = row.body.length > 80 ? `${row.body.slice(0, 80)}…` : row.body;
          showToast({ message: `${name} · #${o.order_number}: ${snippet}`, type: 'success', duration: 4200 });
          const prefs = await getSoundSettings();
          if (prefs.sounds && prefs.chat) {
            if (prefs.vibrate) blip();
            await notifyLocal({
              channel: CHANNEL_CHAT,
              title: `${name} · #${o.order_number}`,
              body: snippet,
              data: { orderId: row.order_id, kind: 'message' },
            });
          }
        })();
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, profile, role, showToast, instanceId]);
}
