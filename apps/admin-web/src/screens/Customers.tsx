import { useMemo, useState } from 'react';
import { TOWN_LABELS } from '@isla/shared';
import type { AdminData } from '../lib/adminData';
import { sumBy } from '../lib/analytics';
import { num, peso } from '../lib/currency';
import { formatDateTime } from '../lib/format';
import { Badge, Card, Empty, SearchInput, Skeleton } from '../components/ui';
import { supabase } from '../lib/supabase';

export function Customers({ data, loading, reload }: { data: AdminData; loading: boolean; reload: () => void }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.profiles
      .filter((p) => p.role === 'customer')
      .map((p) => {
        const orders = data.orders.filter((o) => o.customer_id === p.id);
        return { p, orders: orders.length, spend: sumBy(orders, (o) => o.grand_total), last: orders[0]?.created_at ?? null };
      })
      .filter(({ p }) => !needle || `${p.full_name} ${p.username} ${p.phone} ${p.email}`.toLowerCase().includes(needle))
      .sort((a, b) => b.spend - a.spend);
  }, [data.profiles, data.orders, q]);

  const toggle = async (id: string, next: boolean) => {
    setBusy(id);
    await supabase.from('profiles').update({ is_active: next }).eq('id', id);
    setBusy(null);
    reload();
  };

  if (loading) return <Card title="Customers"><Skeleton lines={6} /></Card>;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="eyebrow">Growth · demand</p>
          <h1 className="hero-title">Customers</h1>
          <p className="hero-sub">{num(rows.length)} customers ranked by lifetime spend (recent window).</p>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search name, phone, email…" />
      </div>
      <Card>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Customer</th><th>Home</th><th>Orders</th><th>Spend</th><th>Last order</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.slice(0, 100).map(({ p, orders, spend, last }) => (
                <tr key={p.id}>
                  <td><strong>{p.full_name || p.username || '—'}</strong><small>{p.phone ?? p.email ?? ''}</small></td>
                  <td>{p.home_town ? TOWN_LABELS[p.home_town] : '—'}</td>
                  <td><strong>{num(orders)}</strong></td>
                  <td><strong>{peso(spend)}</strong></td>
                  <td>{last ? formatDateTime(last) : '—'}</td>
                  <td>{p.is_active ? <Badge tone="ok">ACTIVE</Badge> : <Badge tone="bad">BLOCKED</Badge>}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy === p.id}
                      onClick={() => void toggle(p.id, !p.is_active)}
                    >
                      {p.is_active ? 'Block' : 'Unblock'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <Empty icon="👥" title="No customers yet" body="App sign-ups will appear here with spend history." /> : null}
        </div>
        <p className="muted">Joined {formatDateTime(data.profiles.find((p) => p.role === 'customer')?.created_at)} (earliest in window) · blocking is reversible and enforced by RLS.</p>
      </Card>
    </div>
  );
}
