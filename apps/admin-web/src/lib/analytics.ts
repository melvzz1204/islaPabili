import type { Database } from '@isla/supabase';

export type Order = Database['public']['Tables']['orders']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Merchant = Database['public']['Tables']['merchants']['Row'];
export type RiderApp = Database['public']['Tables']['rider_applications']['Row'];
export type RiderStatus = Database['public']['Tables']['rider_status']['Row'];
export type Tx = Database['public']['Tables']['transactions']['Row'];
export type Wallet = Database['public']['Tables']['wallets']['Row'];
export type Rating = Database['public']['Tables']['ratings']['Row'];
export type Voucher = Database['public']['Tables']['vouchers']['Row'];

export type RangeKey = 'today' | '7d' | '30d' | 'all';

export function rangeStart(key: RangeKey): Date | null {
  const now = new Date();
  if (key === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (key === '7d') return new Date(now.getTime() - 7 * 86400_000);
  if (key === '30d') return new Date(now.getTime() - 30 * 86400_000);
  return null;
}

export function inRange(iso: string, key: RangeKey): boolean {
  const start = rangeStart(key);
  if (!start) return true;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= start.getTime();
}

export type DayBucket = { label: string; key: string; orders: number; gmv: number };

export function last14Days(orders: Order[]): DayBucket[] {
  const buckets: DayBucket[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400_000);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    buckets.push({
      key,
      label: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
      orders: 0,
      gmv: 0,
    });
  }
  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const o of orders) {
    const d = new Date(o.created_at);
    if (!Number.isFinite(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const b = map.get(key);
    if (b) {
      b.orders += 1;
      b.gmv += Number(o.grand_total ?? 0);
    }
  }
  return buckets;
}

export function groupCount<T>(items: T[], key: (t: T) => string): { key: string; value: number }[] {
  const m = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([k, v]) => ({ key: k, value: v }))
    .sort((a, b) => b.value - a.value);
}

export function sumBy<T>(items: T[], pick: (t: T) => number): number {
  return items.reduce((acc, t) => acc + (Number.isFinite(Number(pick(t))) ? Number(pick(t)) : 0), 0);
}

export function avgRating(ratings: Rating[]): number | null {
  if (ratings.length === 0) return null;
  return ratings.reduce((a, r) => a + r.stars, 0) / ratings.length;
}

export function delta(current: number, previous: number): { text: string; up: boolean | null } {
  if (!previous) return { text: '—', up: null };
  const d = ((current - previous) / previous) * 100;
  return { text: `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`, up: d >= 0 };
}
