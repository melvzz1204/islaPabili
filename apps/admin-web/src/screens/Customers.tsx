import { useMemo, useState } from 'react';
import { TOWN_LABELS } from '@isla/shared';
import type { AdminData, Profile } from '../lib/adminData';
import { profileById } from '../lib/adminData';
import { avgRating, sumBy } from '../lib/analytics';
import { num, peso } from '../lib/currency';
import { formatDateTime, townSummary } from '../lib/format';
import { Badge, Card, Detail, Empty, Modal, SearchInput, Skeleton, statusTone } from '../components/ui';
import { supabase } from '../lib/supabase';

export function Customers({ data, loading, reload }: { data: AdminData; loading: boolean; reload: () => void }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data.profiles.find((p) => p.id === selectedId && p.role === 'customer') ?? null;

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
          <p className="hero-sub">{num(rows.length)} customers ranked by lifetime spend (recent window). Select a row for the full account file.</p>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search name, phone, email…" />
      </div>
      <Card>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Customer</th><th>Home</th><th>Orders</th><th>Spend</th><th>Last order</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.slice(0, 100).map(({ p, orders, spend, last }) => (
                <tr key={p.id} className="row-link" onClick={() => setSelectedId(p.id)}>
                  <td><strong>{p.full_name || p.username || '—'}</strong><small>{p.phone ?? p.email ?? ''}</small></td>
                  <td>{p.home_town ? TOWN_LABELS[p.home_town] : '—'}</td>
                  <td><strong>{num(orders)}</strong></td>
                  <td><strong>{peso(spend)}</strong></td>
                  <td>{last ? formatDateTime(last) : '—'}</td>
                  <td>{p.is_active ? <Badge tone="ok">ACTIVE</Badge> : <Badge tone="bad">BLOCKED</Badge>}</td>
                  <td onClick={(e) => e.stopPropagation()}>
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

      {selected ? (
        <Modal
          title={selected.full_name || selected.username || 'Customer'}
          subtitle={`Member since ${formatDateTime(selected.created_at)}`}
          onClose={() => setSelectedId(null)}
          wide
        >
          <CustomerFile
            customer={selected}
            data={data}
            busy={busy === selected.id}
            onToggle={() => void toggle(selected.id, !selected.is_active).then(() => {
              if (!selected.is_active) setSelectedId(null);
            })}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function CustomerFile({
  customer,
  data,
  busy,
  onToggle,
}: {
  customer: Profile;
  data: AdminData;
  busy: boolean;
  onToggle: () => void;
}) {
  const orders = useMemo(
    () => data.orders.filter((o) => o.customer_id === customer.id),
    [data.orders, customer.id],
  );
  const ratings = useMemo(
    () => data.ratings.filter((r) => r.customer_id === customer.id),
    [data.ratings, customer.id],
  );
  const done = orders.filter((o) => o.status === 'completed').length;
  const cancelled = orders.filter((o) => o.status === 'cancelled' || o.status === 'failed').length;
  const active = orders.filter((o) =>
    ['awaiting_merchant', 'preparing', 'ready', 'pending_dispatch', 'rider_assigned', 'items_purchased', 'in_transit'].includes(o.status),
  ).length;
  const rating = avgRating(ratings);
  const initial = (customer.full_name || customer.username || '?').charAt(0).toUpperCase();

  return (
    <div className="stack">
      <div className="profile-head">
        <div className="profile-avatar">{initial}</div>
        <div className="profile-id">
          <strong>{customer.full_name || '—'}</strong>
          <small>@{customer.username || '—'} · {customer.id.slice(0, 8)}…</small>
        </div>
        {customer.is_active ? <Badge tone="ok">ACTIVE</Badge> : <Badge tone="bad">BLOCKED</Badge>}
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onToggle}>
          {customer.is_active ? 'Block account' : 'Unblock account'}
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label">Orders</div><div className="kpi-value">{num(orders.length)}</div><div className="kpi-hint">{num(active)} active now</div></div>
        <div className="kpi kpi-green"><div className="kpi-label">Lifetime spend</div><div className="kpi-value">{peso(sumBy(orders, (o) => o.grand_total))}</div><div className="kpi-hint">{num(done)} completed · {num(cancelled)} cancelled</div></div>
        <div className="kpi kpi-orange"><div className="kpi-label">Ratings given</div><div className="kpi-value">{rating ? `★ ${rating.toFixed(1)}` : '—'}</div><div className="kpi-hint">{num(ratings.length)} reviews</div></div>
      </div>

      <Card title="Account information" subtitle="Profile record">
        <div className="detail-grid">
          <Detail label="Full name" value={customer.full_name || '—'} />
          <Detail label="Username" value={customer.username ? `@${customer.username}` : '—'} />
          <Detail label="Email" value={customer.email || '—'} />
          <Detail label="Phone" value={customer.phone || '—'} />
          <Detail label="Home town" value={customer.home_town ? TOWN_LABELS[customer.home_town] : '—'} />
          <Detail label="Municipalities" value={townSummary(customer.town_preferences)} />
          <Detail label="Delivery address" value={customer.address || '—'} />
          <Detail label="Last updated" value={formatDateTime(customer.updated_at)} />
        </div>
        {!customer.phone ? <p className="muted">No phone on file — onboarding is incomplete for this account.</p> : null}
      </Card>

      <Card title="Recent orders" subtitle={`${num(orders.length)} in window`}>
        {orders.length === 0 ? (
          <Empty icon="🧾" title="No orders yet" body="This customer has not placed an order in the loaded window." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Date</th><th>Rider</th><th>Status</th><th>Total</th></tr></thead>
              <tbody>
                {orders.slice(0, 10).map((o) => {
                  const rider = profileById(data.profiles, o.rider_id);
                  return (
                    <tr key={o.id}>
                      <td><strong>{o.order_number}</strong><small>{o.fulfillment_mode?.replace(/_/g, ' ') ?? ''}</small></td>
                      <td>{formatDateTime(o.created_at)}</td>
                      <td>{rider ? rider.full_name || rider.username : '—'}</td>
                      <td><Badge tone={statusTone(o.status)}>{o.status.replace(/_/g, ' ').toUpperCase()}</Badge></td>
                      <td><strong>{peso(Number(o.grand_total ?? 0))}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Ratings given" subtitle="Reviews this customer left for riders">
        {ratings.length === 0 ? (
          <Empty icon="★" title="No reviews yet" body="Ratings appear here after completed deliveries." />
        ) : (
          <ul className="attention">
            {ratings.slice(0, 10).map((r) => {
              const rider = profileById(data.profiles, r.rider_id);
              const order = data.orders.find((o) => o.id === r.order_id);
              return (
                <li key={r.id}>
                  <span className="stars">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</span>
                  <span>
                    <strong>{rider?.full_name || rider?.username || 'Rider'}</strong>
                    <small>{r.comment || 'No comment'} · {order ? `#${order.order_number} · ` : ''}{formatDateTime(r.created_at)}</small>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
