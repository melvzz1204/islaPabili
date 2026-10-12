import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, type Supabase } from '@isla/supabase';
import type { Database } from '@isla/supabase';

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
