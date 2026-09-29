import { useMemo, useState } from 'react';
import { TOWN_LABELS } from '@isla/shared';
import type { AdminData } from '../lib/adminData';
import { merchantById, profileById } from '../lib/adminData';
import { peso } from '../lib/currency';
import { formatDateTime } from '../lib/format';
import { Badge, Card, Detail, Empty, Modal, SearchInput, Segmented, Skeleton, statusTone } from '../components/ui';
import { ConversationThread } from '../components/conversation';
import type { Order } from '../lib/adminData';

const STATUSES = ['all', 'live', 'pending_dispatch', 'awaiting_merchant', 'preparing', 'ready', 'in_transit', 'completed', 'cancelled'] as const;
type F = (typeof STATUSES)[number];

export function Orders({ data, loading }: { data: AdminData; loading: boolean }) {
  const [filter, setFilter] = useState<F>('all');
  const [q, setQ] = useState('');
  const [town, setTown] = useState('all');
  const [selected, setSelected] = useState<Order | null>(null);

  const counts = useMemo(() => {
    const live = data.orders.filter((o) => !['completed', 'cancelled', 'failed'].includes(o.status)).length;
    const withChat = new Set(data.orderMessages.map((m) => m.order_id)).size;
    return { all: data.orders.length, live, withChat };
  }, [data.orders, data.orderMessages]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.orders.filter((o) => {
      if (filter === 'live' && ['completed', 'cancelled', 'failed'].includes(o.status)) return false;
      if (filter !== 'all' && filter !== 'live' && o.status !== filter) return false;
      if (town !== 'all' && o.town !== town) return false;
      if (needle) {
        const c = profileById(data.profiles, o.customer_id);
        const hay = `${o.order_number} ${c?.full_name ?? ''} ${c?.phone ?? ''} ${o.dropoff_address ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [data.orders, data.profiles, filter, town, q]);

  if (loading) return <Card title="Orders"><Skeleton lines={6} /></Card>;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="eyebrow">Operations · order book</p>
          <h1 className="hero-title">Orders</h1>
          <p className="hero-sub">{counts.live} live · {counts.all} total in the last 600 · {counts.withChat} with chat. Click any row for the full trail.</p>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search order no., customer, address…" />
      </div>

      <Card>
        <div className="toolbar">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={STATUSES.map((s) => ({
              key: s,
              label: s === 'all' ? 'All' : s === 'live' ? `Live` : s.replaceAll('_', ' '),
              count: s === 'all' ? counts.all : s === 'live' ? counts.live : data.orders.filter((o) => o.status === s).length,
            }))}
          />
          <select className="input" value={town} onChange={(e) => setTown(e.target.value)} aria-label="Town">
            <option value="all">All towns</option>
            {Object.entries(TOWN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {visible.length === 0 ? (
          <Empty icon="🧾" title="No orders match" body="Try a different status, town, or search term." action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => { setFilter('all'); setTown('all'); setQ(''); }}>Clear filters</button>} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Customer</th><th>Merchant</th><th>Total</th><th>Status</th><th /></tr></thead>
              <tbody>
                {visible.slice(0, 80).map((o) => {
                  const c = profileById(data.profiles, o.customer_id);
                  const m = merchantById(data.merchants, o.merchant_id);
                  const chatCount = data.orderMessages.filter((msg) => msg.order_id === o.id).length;
                  return (
                    <tr key={o.id} className="rowlink" onClick={() => setSelected(o)}>
                      <td><strong>{o.order_number}</strong><small>{formatDateTime(o.created_at)} · {TOWN_LABELS[o.town as keyof typeof TOWN_LABELS] ?? o.town}</small></td>
                      <td>{c?.full_name || c?.username || '—'}<small>{c?.phone ?? ''}</small></td>
                      <td>{o.is_custom_list ? 'Custom pabili' : (m?.name ?? '—')}<small>{o.payment_method.toUpperCase()} · {o.fulfillment_mode.replaceAll('_', ' ')}</small></td>
                      <td><strong>{peso(o.grand_total)}</strong><small>fee {peso(o.total_delivery_fee)}</small></td>
                      <td><Badge tone={statusTone(o.status)}>{o.status.replaceAll('_', ' ')}</Badge></td>
                      <td><span className="go">{chatCount > 0 ? `💬${chatCount} →` : '→'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length > 80 ? <p className="muted center">Showing first 80 of {visible.length} — refine filters to narrow.</p> : null}
          </div>
        )}
      </Card>

      {selected ? (
        <Modal title={selected.order_number} subtitle={`${formatDateTime(selected.created_at)} · ${selected.status.replaceAll('_', ' ')}`} onClose={() => setSelected(null)} wide>
          <OrderDetail data={data} order={selected} />
        </Modal>
      ) : null}
    </div>
  );
}

export function OrderDetail({ data, order }: { data: AdminData; order: Order }) {
  const customer = profileById(data.profiles, order.customer_id);
  const rider = profileById(data.profiles, order.rider_id);
  const merchant = merchantById(data.merchants, order.merchant_id);
  const items = data.orderItems.filter((i) => i.order_id === order.id);
  const messageCount = data.orderMessages.filter((m) => m.order_id === order.id).length;
  return (
    <div className="stack">
      <div className="detail-grid">
        <Detail label="Status" value={<Badge tone={statusTone(order.status)}>{order.status.replaceAll('_', ' ')}</Badge>} />
        <Detail label="Grand total" value={peso(order.grand_total)} />
        <Detail label="Items estimate" value={peso(order.est_items_total)} />
        <Detail label="Delivery fee" value={peso(order.total_delivery_fee)} />
        <Detail label="Discount" value={`−${peso(order.discount_amount)}`} />
        <Detail label="Tip" value={peso(order.tip_amount)} />
        <Detail label="Payment" value={`${order.payment_method.toUpperCase()} · ${order.is_paid ? 'paid' : 'unpaid'}`} />
        <Detail label="Fulfillment" value={order.fulfillment_mode.replaceAll('_', ' ')} />
      </div>
      <div className="detail-grid">
        <Detail label="Customer" value={`${customer?.full_name || customer?.username || '—'} · ${customer?.phone || ''}`} />
        <Detail label="Rider" value={rider ? `${rider.full_name || rider.username} · ${rider.phone || ''}` : 'Unassigned'} />
        <Detail label="Merchant" value={order.is_custom_list ? `Custom: ${order.pickup_name || 'pabili list'}` : (merchant?.name ?? '—')} />
        <Detail label="Drop-off" value={order.dropoff_address || '—'} />
      </div>
      <div className="panel-soft">
        <h4>Items ({items.length})</h4>
        {items.length === 0 ? <p className="muted">No item lines captured.</p> : (
          <ul className="lines">
            {items.map((i) => (
              <li key={i.id}><span>{i.quantity}× {i.name}</span><span>{i.estimated_price ? peso(i.estimated_price) : '—'}</span></li>
            ))}
          </ul>
        )}
      </div>
      <div className="panel-soft">
        <h4>Conversation ({messageCount})</h4>
        <ConversationThread data={data} orderId={order.id} />
      </div>
      <div className="timeline">
        {[
          ['Created', order.created_at],
          ['Accepted', order.accepted_at],
          ['Purchased', order.purchased_at],
          ['In transit', order.in_transit_at],
          ['Completed', order.completed_at],
          ['Cancelled', order.cancelled_at],
        ].filter(([, t]) => !!t).map(([k, t]) => (
          <div key={k} className="t-row"><span className="t-dot" /><span><strong>{k}</strong><small>{formatDateTime(t as string)}</small></span></div>
        ))}
      </div>
    </div>
  );
}
