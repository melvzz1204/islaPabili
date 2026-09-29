import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@isla/supabase';
import { supabase } from './supabase';

export type Order = Database['public']['Tables']['orders']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Merchant = Database['public']['Tables']['merchants']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type RiderApp = Database['public']['Tables']['rider_applications']['Row'];
export type RiderStatus = Database['public']['Tables']['rider_status']['Row'];
export type Tx = Database['public']['Tables']['transactions']['Row'];
export type Wallet = Database['public']['Tables']['wallets']['Row'];
export type Rating = Database['public']['Tables']['ratings']['Row'];
export type Voucher = Database['public']['Tables']['vouchers']['Row'];
export type Fare = Database['public']['Tables']['fare_config']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type AppRelease = Database['public']['Tables']['app_releases']['Row'];
export type OrderMessage = Database['public']['Tables']['order_messages']['Row'];

export type AdminData = {
  orders: Order[];
  profiles: Profile[];
  merchants: Merchant[];
  products: Product[];
  riderApps: RiderApp[];
  riderStatus: RiderStatus[];
  transactions: Tx[];
  wallets: Wallet[];
  ratings: Rating[];
  vouchers: Voucher[];
  fares: Fare[];
  orderItems: OrderItem[];
  orderMessages: OrderMessage[];
  releases: AppRelease[];
};

const EMPTY: AdminData = {
  orders: [], profiles: [], merchants: [], products: [], riderApps: [],
  riderStatus: [], transactions: [], wallets: [], ratings: [], vouchers: [],
  fares: [], orderItems: [], orderMessages: [], releases: [],
};

export function useAdminData() {
  const [data, setData] = useState<AdminData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        orders, profiles, merchants, products, riderApps, riderStatus,
        transactions, wallets, ratings, vouchers, fares, orderItems, orderMessages, releases,
      ] = await Promise.all([
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(600),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('merchants').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('products').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('rider_applications').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('rider_status').select('*').limit(500),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('wallets').select('*').limit(500),
        supabase.from('ratings').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('vouchers').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('fare_config').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('order_items').select('*').order('created_at', { ascending: false }).limit(1500),
        supabase.from('order_messages').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('app_releases').select('*').order('build_number', { ascending: false }).limit(20),
      ]);
      const firstErr = [orders, profiles, merchants, products, riderApps, riderStatus, transactions, wallets, ratings, vouchers, fares, orderItems, orderMessages, releases]
        .find((r) => r.error)?.error;
      if (firstErr) throw new Error(firstErr.message);
      setData({
        orders: orders.data ?? [],
        profiles: profiles.data ?? [],
        merchants: merchants.data ?? [],
        products: products.data ?? [],
        riderApps: riderApps.data ?? [],
        riderStatus: riderStatus.data ?? [],
        transactions: transactions.data ?? [],
        wallets: wallets.data ?? [],
        ratings: ratings.data ?? [],
        vouchers: vouchers.data ?? [],
        fares: fares.data ?? [],
        orderItems: orderItems.data ?? [],
        orderMessages: (orderMessages.data ?? []) as AdminData['orderMessages'],
        releases: (releases.data ?? []) as AdminData['releases'],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { data, loading, error, reload: load };
}

export function profileById(profiles: Profile[], id: string | null): Profile | undefined {
  if (!id) return undefined;
  return profiles.find((p) => p.id === id);
}

export function merchantById(merchants: Merchant[], id: string | null): Merchant | undefined {
  if (!id) return undefined;
  return merchants.find((m) => m.id === id);
}
