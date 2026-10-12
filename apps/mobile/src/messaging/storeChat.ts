import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, type Supabase } from '@isla/supabase';
import type { Database } from '@isla/supabase';
import { useToast } from '@isla/ui';
import { CHANNEL_CHAT, blip, getSoundSettings, notifyLocal } from '../lib/notify';
import { getOpenOrderId } from './chat';

export type StoreMessageRow = Database['public']['Tables']['store_messages']['Row'];

export type StoreConversation = {
  merchantId: string;
  merchantName: string;
  customerId: string;
  customerName: string;
  lastMessage: StoreMessageRow | null;
  unread: boolean;
};

/**
 * Pre-order inquiry thread, keyed by (merchant_id, customer_id).
 * No order row needed — the customer can ask about stock/price first.
 *
 * Jollibee is excluded in the UI layer (isJollibeeMerchantName): the flagship
 * is rider-delivery-only, so StoreScreen never offers this entry for it.
 */
export async function fetchStoreThread(
  client: Supabase,
  merchantId: string,
  customerId: string,
): Promise<StoreMessageRow[]> {
  const { data, error } = await client
    .from('store_messages')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as StoreMessageRow[];
}

export async function sendStoreMessage(
  client: Supabase,
  args: { merchantId: string; customerId: string; senderId: string; body: string },
): Promise<void> {
  const { error } = await client.from('store_messages').insert({
    merchant_id: args.merchantId,
    customer_id: args.customerId,
    sender_id: args.senderId,
    body: args.body.slice(0, 2000),
  });
  if (error) throw new Error(error.message);
}

export function useStoreThreadRealtime(
  client: Supabase | null,
  merchantId: string,
  customerId: string,
  onInsert: (row: StoreMessageRow) => void,
) {
  const instanceId = useMemo(() => Math.random().toString(36).slice(2, 9), []);
  useEffect(() => {
    if (!client || !merchantId || !customerId) return;
    const channel = client
      .channel(`store-thread-${merchantId}-${customerId.slice(0, 8)}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'store_messages', filter: `merchant_id=eq.${merchantId}` },
        (payload) => {
          const row = payload.new as StoreMessageRow;
          if (row.customer_id !== customerId) return;
          onInsert(row);
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, merchantId, customerId, instanceId, onInsert]);
}

/** Group raw rows into per-counterpart conversations with unread flags. */
export function toStoreConversations(
  rows: StoreMessageRow[],
  meId: string,
  names: Record<string, string>,
  opts: { counterpart: 'merchant' | 'customer' },
): StoreConversation[] {
  const byKey = new Map<string, StoreMessageRow[]>();
  for (const r of rows) {
    const key = opts.counterpart === 'merchant' ? r.merchant_id : r.customer_id;
    const list = byKey.get(key) ?? [];
    list.push(r);
    byKey.set(key, list);
  }
  const out: StoreConversation[] = [];
  for (const list of byKey.values()) {
    list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    const last = list[list.length - 1] ?? null;
    const first = list[0];
    if (!first || !last) continue;
    out.push({
      merchantId: first.merchant_id,
      merchantName: names[first.merchant_id] ?? 'Store',
      customerId: first.customer_id,
      customerName: names[first.customer_id] ?? 'Customer',
      lastMessage: last,
      unread: !!last && last.sender_id !== meId,
    });
  }
  out.sort((a, b) =>
    (a.lastMessage?.created_at ?? '') < (b.lastMessage?.created_at ?? '') ? 1 : -1,
  );
  return out;
}

export function useRefreshKey(): [number, () => void] {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  return [tick, bump];
}

/** Badge count for pre-order inquiries (latest message from the other party). */
export function useUnreadStoreCount(): number {
  const { client, profile } = useAuth();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!profile) {
      setCount(0);
      return;
    }
    try {
      const { data } = await client
        .from('store_messages')
        .select('merchant_id,customer_id,sender_id,created_at')
        .eq('customer_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(100);
      const rows = (data ?? []) as Pick<StoreMessageRow, 'merchant_id' | 'customer_id' | 'sender_id' | 'created_at'>[];
      const seen = new Set<string>();
      let n = 0;
      for (const r of rows) {
        if (seen.has(r.merchant_id)) continue;
        seen.add(r.merchant_id);
        if (r.sender_id !== profile.id) n += 1;
      }
      setCount(n);
    } catch {
      // Offline: keep last count.
    }
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const instanceId = useMemo(() => Math.random().toString(36).slice(2, 9), []);
  useEffect(() => {
    if (!profile) return;
    const channel = client
      .channel(`store-unread-${profile.id}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'store_messages', filter: `customer_id=eq.${profile.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, profile, load, instanceId]);

  return count;
}

/**
 * Merchant-side inquiry inbox: per-customer threads with names, unread flags,
 * and totals. Powers the Messages tab list, the tab badge, and the header
 * message button.
 */
export function useMerchantInquiries(merchantId: string): {
  conversations: StoreConversation[];
  unread: number;
  loading: boolean;
} {
  const { client, profile } = useAuth();
  const [rows, setRows] = useState<StoreMessageRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await client
        .from('store_messages')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(100);
      const list = (data ?? []) as StoreMessageRow[];
      setRows(list);
      const ids = [...new Set(list.map((r) => r.customer_id))];
      if (ids.length > 0) {
        const { data: people } = await client.from('profiles').select('id, full_name').in('id', ids);
        const map: Record<string, string> = {};
        for (const p of (people ?? []) as { id: string; full_name: string }[]) {
          map[p.id] = p.full_name?.trim() || 'Customer';
        }
        setNames(map);
      }
    } catch {
      // Offline: keep stale rows.
    } finally {
      setLoading(false);
    }
  }, [client, profile, merchantId]);

  useEffect(() => {
    void load();
    const channel = client
      .channel(`store-inquiries-${merchantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'store_messages', filter: `merchant_id=eq.${merchantId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, merchantId, load]);

  const conversations = useMemo(
    () => (profile ? toStoreConversations(rows, profile.id, names, { counterpart: 'customer' }) : []),
    [rows, names, profile],
  );
  return { conversations, unread: conversations.filter((c) => c.unread).length, loading };
}

/** Store thread currently on screen (`merchantId:customerId`), banners stay quiet for it. */
let openStoreThread: string | null = null;

export function setOpenStoreThread(key: string | null) {
  openStoreThread = key;
}

async function bannerForBody(
  showToast: (t: { message: string; type: 'success'; duration?: number }) => void,
  title: string,
  snippet: string,
  data: { orderId?: string; merchantId?: string; kind: 'message' },
) {
  showToast({ message: `${title}: ${snippet}`, type: 'success', duration: 4200 });
  const prefs = await getSoundSettings();
  if (prefs.sounds && prefs.chat) {
    if (prefs.vibrate) blip();
    await notifyLocal({ channel: CHANNEL_CHAT, title, body: snippet, data });
  }
}

/**
 * Mount once in the merchant shell. Pops a toast banner whenever the other
 * party writes in one of this store's threads — order chats and pre-order
 * inquiries alike — except the thread already open on screen.
 */
export function useMerchantMessageAlerts(merchantId: string) {
  const { client, profile } = useAuth();
  const { showToast } = useToast();
  const instanceId = useMemo(() => Math.random().toString(36).slice(2, 9), []);

  useEffect(() => {
    if (!profile) return;
    const channel = client
      .channel(`merchant-message-alerts-${merchantId}-${instanceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_messages' }, (payload) => {
        const row = payload.new as { order_id: string; sender_id: string; body: string };
        if (row.sender_id === profile.id || row.order_id === getOpenOrderId()) return;
        void (async () => {
          const { data } = await client
            .from('orders')
            .select('id, order_number, merchant_id')
            .eq('id', row.order_id)
            .maybeSingle();
          const o = data as { order_number: string; merchant_id: string | null } | null;
          if (!o || o.merchant_id !== merchantId) return;
          const { data: person } = await client
            .from('profiles')
            .select('full_name')
            .eq('id', row.sender_id)
            .maybeSingle();
          const name = (person as { full_name?: string } | null)?.full_name?.trim() || 'New message';
          const snippet = row.body.length > 80 ? `${row.body.slice(0, 80)}…` : row.body;
          await bannerForBody(showToast, `${name} · #${o.order_number}`, snippet, {
            orderId: row.order_id,
            kind: 'message',
          });
        })();
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'store_messages', filter: `merchant_id=eq.${merchantId}` },
        (payload) => {
          const row = payload.new as { merchant_id: string; customer_id: string; sender_id: string; body: string };
          if (row.sender_id === profile.id) return;
          if (openStoreThread === `${row.merchant_id}:${row.customer_id}`) return;
          void (async () => {
            const { data: person } = await client
              .from('profiles')
              .select('full_name')
              .eq('id', row.sender_id)
              .maybeSingle();
            const name = (person as { full_name?: string } | null)?.full_name?.trim() || 'Customer question';
            const snippet = row.body.length > 80 ? `${row.body.slice(0, 80)}…` : row.body;
            await bannerForBody(showToast, name, snippet, {
              merchantId: row.merchant_id,
              kind: 'message',
            });
          })();
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, profile, merchantId, showToast, instanceId]);
}
