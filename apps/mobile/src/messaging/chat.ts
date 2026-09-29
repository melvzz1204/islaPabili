import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, type Database } from '@isla/supabase';
import { useToast } from '@isla/ui';
import { CHANNEL_CHAT, blip, getSoundSettings, notifyLocal } from '../lib/notify';

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

export type Conversation = {
  order: OrderRow;
  lastMessage: MessageRow | null;
  unread: boolean;
};

/** Customer + rider shared: orders with a rider attached and their latest message. */
export function useConversations(role: 'customer' | 'rider') {
  const { client, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
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
    if (list.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }
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
    setConversations(
      list.map((order) => {
        const last = latest.get(order.id) ?? null;
        return { order, lastMessage: last, unread: !!last && last.sender_id !== profile.id };
      }),
    );
    setLoading(false);
  }, [client, profile, role]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live: any new message in my conversations refreshes the list preview.
  // NOTE: the channel name includes a per-hook random suffix. `client.channel()`
  // returns the same instance for an identical topic, and realtime-js throws if
  // `.on()` is called after `.subscribe()` — this hook mounts 2-3x at once
  // (tab badge + header badge + list), so a shared name crashes the app.
  const instanceId = useMemo(() => Math.random().toString(36).slice(2, 9), []);
  useEffect(() => {
    if (!profile) return;
    const channel = client
      .channel(`conversations-${role}-${profile.id}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_messages' },
        () => void load(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: role === 'customer' ? `customer_id=eq.${profile.id}` : `rider_id=eq.${profile.id}`,
        },
        () => void load(),
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

/** Order thread currently on screen — banners stay quiet for it. */
let openOrderId: string | null = null;

export function setOpenOrderId(orderId: string | null) {
  openOrderId = orderId;
}

/**
 * Mount once per shell (customer tabs, rider home). Pops a toast banner
 * whenever the other party writes in one of my orders — except the thread
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
