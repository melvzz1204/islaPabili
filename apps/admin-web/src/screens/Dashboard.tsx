import { useMemo, useState } from 'react';
import { TOWN_LABELS } from '@isla/shared';
import type { AdminData } from '../lib/adminData';
import { merchantById, profileById } from '../lib/adminData';
import { avgRating, groupCount, inRange, last14Days, sumBy, type RangeKey } from '../lib/analytics';
import { num, peso, pesoShort, pct } from '../lib/currency';
import { formatDateTime } from '../lib/format';
import { Badge, Card, Empty, Kpi, Skeleton, statusTone } from '../components/ui';
import { Donut, Hbars, Spark, TrendChart } from '../components/charts';
import type { AdminTab } from '../components/layout';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
];

const STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  in_transit: '#0ea5e9',
  preparing: '#8b5cf6',
  ready: '#f59e0b',
  pending_dispatch: '#f97316',
  awaiting_merchant: '#eab308',
  cancelled: '#ef4444',
  declined: '#ef4444',
  failed: '#64748b',
  rider_assigned: '#14b8a6',
  items_purchased: '#06b6d4',
};

export function Dashboard({ data, loading, go }: {
  data: AdminData;
  loading: boolean;
  go: (t: AdminTab) => void;
}) {
  const [range, setRange] = useState<RangeKey>('30d');
  const [trendMode, setTrendMode] = useState<'gmv' | 'orders'>('gmv');

  const orders = useMemo(() => data.orders.filter((o) => inRange(o.created_at, range)), [data.orders, range]);
  const trend = useMemo(() => last14Days(data.orders), [data.orders]);
  const gmv = sumBy(orders, (o) => o.grand_total);
  const fees = sumBy(orders, (o) => o.total_delivery_fee);
  const tips = sumBy(orders, (o) => o.tip_amount);
  const discounts = sumBy(orders, (o) => o.discount_amount);
  const completed = orders.filter((o) => o.status === 'completed');
  const active = orders.filter((o) => !['completed', 'cancelled', 'failed'].includes(o.status));
  const rating = avgRating(data.ratings);
  const onDuty = data.riderStatus.filter((r) => r.on_duty);
  const pendingApps = data.riderApps.filter((a) => a.status === 'pending');

  const byStatus = useMemo(
    () => groupCount(orders, (o) => o.status).slice(0, 7).map((s) => ({
      key: s.key, label: s.key.replaceAll('_', ' '), value: s.value, color: STATUS_COLORS[s.key] ?? '#008080',
    })),
    [orders],
  );
  const byTown = useMemo(
    () => groupCount(orders, (o) => o.town).map((t) => ({
      key: t.key, label: TOWN_LABELS[t.key as keyof typeof TOWN_LABELS] ?? t.key, value: t.value,
    })),
    [orders],
  );
  const topMerchants = useMemo(() => {
    const m = new Map<string, { orders: number; gmv: number }>();
    for (const o of orders) {
      if (!o.merchant_id) continue;
      const cur = m.get(o.merchant_id) ?? { orders: 0, gmv: 0 };
      cur.orders += 1;
      cur.gmv += Number(o.grand_total ?? 0);
      m.set(o.merchant_id, cur);
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, ...v, name: merchantById(data.merchants, id)?.name ?? 'Custom pabili' }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 5);
  }, [orders, data.merchants]);

  if (loading) {
    return (
      <div className="stack">
        <div className="kpi-grid">{[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="panel"><Skeleton lines={3} /></div>
        ))}</div>
        <div className="panel"><Skeleton lines={5} /></div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="hero">
        <div>
          <p className="eyebrow">Marinduque · island operations</p>
          <h1 className="hero-title">Kumusta, Admin — here&apos;s the island today.</h1>
          <p className="hero-sub">
            {num(orders.length)} orders · {peso(gmv)} GMV · {pct(completed.length, orders.length)} completion
            {rating ? ` · ★ ${rating.toFixed(1)} rider rating` : ''} in {RANGES.find((r) => r.key === range)?.label.toLowerCase()}.
          </p>
        </div>
        <div className="hero-actions">
          <div className="seg">
            {RANGES.map((r) => (
              <button key={r.key} type="button" className={`seg-btn ${range === r.key ? 'seg-active' : ''}`} onClick={() => setRange(r.key)}>
                {r.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => go('orders')}>View live orders →</button>
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi tone="teal" icon="₱" label="Gross merchandise value" value={pesoShort(gmv)} hint={`${num(completed.length)} completed · ${pesoShort(fees)} fees`} delta={range === 'all' ? undefined : 'in range'} />
        <Kpi tone="orange" icon="🧾" label="Orders" value={num(orders.length)} hint={`${num(active.length)} live right now`} />
        <Kpi tone="green" icon="✓" label="Completion rate" value={pct(completed.length, orders.length)} hint={`${num(completed.length)} of ${num(orders.length)} done`} />
        <Kpi tone="blue" icon="🛵" label="Riders on duty" value={num(onDuty.length)} hint={`${num(data.riderStatus.length)} tracked · ${num(data.profiles.filter((p) => p.role === 'rider').length)} riders`} />
        <Kpi tone="violet" icon="★" label="Avg rider rating" value={rating ? rating.toFixed(2) : '—'} hint={`${num(data.ratings.length)} reviews`} />
        <Kpi tone="red" icon="⏳" label="Pending rider approvals" value={num(pendingApps.length)} hint="Needs review" delta={pendingApps.length > 0 ? 'action' : undefined} />
      </div>

      <div className="grid-2">
        <Card
          title={trendMode === 'gmv' ? 'Revenue trend' : 'Order volume trend'}
          subtitle="Last 14 days · all towns"
          action={
            <div className="seg seg-sm">
              {(['gmv', 'orders'] as const).map((m) => (
                <button key={m} type="button" className={`seg-btn ${trendMode === m ? 'seg-active' : ''}`} onClick={() => setTrendMode(m)}>
                  {m === 'gmv' ? 'GMV' : 'Orders'}
                </button>
              ))}
            </div>
          }
        >
          <TrendChart data={trend} mode={trendMode} />
          <div className="mini-stats">
            <span>Tips <strong>{pesoShort(tips)}</strong></span>
            <span>Discounts <strong>−{pesoShort(discounts)}</strong></span>
            <span>Delivery fees <strong>{pesoShort(fees)}</strong></span>
          </div>
        </Card>
        <Card title="Order mix by status" subtitle="Where demand sits right now">
          <Donut items={byStatus} />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Demand by municipality" subtitle="Boac usually leads — watch the tails">
          <Hbars items={byTown} />
        </Card>
        <Card
          title="Top merchants"
          subtitle="By GMV in selected range"
          action={<button type="button" className="btn btn-ghost btn-sm" onClick={() => go('merchants')}>Manage →</button>}
        >
          {topMerchants.length === 0 ? (
            <Empty icon="🏪" title="No merchant orders yet" body="Merchant-attributed orders will rank here once checkout flows." />
          ) : (
            <ul className="rank">
              {topMerchants.map((m, i) => (
                <li key={m.id}>
                  <span className="rank-n">{i + 1}</span>
                  <span className="rank-name">{m.name}<small>{num(m.orders)} orders</small></span>
                  <strong>{peso(m.gmv)}</strong>
                  <Spark values={trend.map((t) => t.gmv)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card
          title="Needs your attention"
          subtitle="Approvals, stuck orders, payouts"
          action={<button type="button" className="btn btn-ghost btn-sm" onClick={() => go('riders')}>Review riders →</button>}
        >
          <ul className="attention">
            {pendingApps.slice(0, 3).map((a) => {
              const p = profileById(data.profiles, a.rider_id);
              return (
                <li key={a.id}>
                  <span className="avatar sm">{(p?.full_name ?? 'R').slice(0, 1)}</span>
                  <span><strong>{p?.full_name || p?.username || 'Unnamed rider'}</strong><small>Applied {formatDateTime(a.created_at)}</small></span>
                  <Badge tone="pending">PENDING</Badge>
                </li>
              );
            })}
            {active.slice(0, 3).map((o) => (
              <li key={o.id}>
                <span className="avatar sm alt">{o.order_number.slice(-2)}</span>
                <span><strong>{o.order_number}</strong><small>{o.status.replaceAll('_', ' ')} · {peso(o.grand_total)}</small></span>
                <Badge tone={statusTone(o.status)}>{o.status.replaceAll('_', ' ').toUpperCase()}</Badge>
              </li>
            ))}
            {pendingApps.length === 0 && active.length === 0 ? (
              <Empty icon="🌊" title="All calm across the island" body="No pending approvals and no live orders. Enjoy the quiet." />
            ) : null}
          </ul>
        </Card>
        <Card
          title="Recent orders"
          subtitle="Latest across all towns"
          action={<button type="button" className="btn btn-ghost btn-sm" onClick={() => go('orders')}>Open order book →</button>}
        >
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Town</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {data.orders.slice(0, 6).map((o) => (
                  <tr key={o.id}>
                    <td><strong>{o.order_number}</strong><small>{formatDateTime(o.created_at)}</small></td>
                    <td>{TOWN_LABELS[o.town as keyof typeof TOWN_LABELS] ?? o.town}</td>
                    <td>{peso(o.grand_total)}</td>
                    <td><Badge tone={statusTone(o.status)}>{o.status.replaceAll('_', ' ')}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.orders.length === 0 ? <Empty icon="🧾" title="No orders yet" body="Orders from the mobile app will stream in here." /> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
