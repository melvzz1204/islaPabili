import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@isla/supabase';
import { supabase } from '../lib/supabase';
import { Badge } from '../components/ui';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type StatusLog = Database['public']['Tables']['order_status_log']['Row'];

type Tab = 'new' | 'preparing' | 'ready' | 'all';

const TAB_STATUS: Record<Tab, string[]> = {
  new: ['awaiting_merchant'],
  preparing: ['preparing'],
  ready: ['ready'],
  all: [],
};

const FULFILLMENT_LABEL: Record<string, string> = {
  merchant_delivery: 'Rider delivery',
  merchant_pickup: 'Self-pickup',
  rider_pabili: 'Rider pabili',
};

const peso = (n: number) =>
  `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function OrdersInbox({ merchantId }: { merchantId: string }) {
  const [tab, setTab] = useState<Tab>('new');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [timeline, setTimeline] = useState<StatusLog[]>([]);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      setError(error.message);
    } else {
      setOrders(data ?? []);
    }
    setLoading(false);
  }, [merchantId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`orders-merchant-${merchantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `merchant_id=eq.${merchantId}` },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [merchantId, load]);

  const openDetail = async (order: OrderRow) => {
    setSelected(order);
    const [{ data: itemRows }, { data: logRows }] = await Promise.all([
      supabase.from('order_items').select('*').eq('order_id', order.id),
      supabase.from('order_status_log').select('*').eq('order_id', order.id).order('created_at', { ascending: true }),
    ]);
    setItems(itemRows ?? []);
    setTimeline(logRows ?? []);
  };

  const transition = async (order: OrderRow, status: OrderRow['status']) => {
    const confirmMsg: Record<string, string> = {
      preparing: `Accept order ${order.order_number} and start preparing?`,
      declined: `Decline order ${order.order_number}? The customer will be offered rider pabili or cancellation.`,
      ready: `Mark order ${order.order_number} as ready?`,
      completed: `Complete order ${order.order_number}? Only after handover to rider or customer.`,
    };
    if (!window.confirm(confirmMsg[status] ?? `Change status to ${status}?`)) return;
    setActing(true);
    const { error } = await supabase.from('orders').update({ status }).eq('id', order.id);
    setActing(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSelected(null);
    await load();
  };

  const visible = tab === 'all' ? orders : orders.filter((o) => TAB_STATUS[tab]?.includes(o.status));
  const counts: Record<Tab, number> = {
    new: orders.filter((o) => o.status === 'awaiting_merchant').length,
    preparing: orders.filter((o) => o.status === 'preparing').length,
    ready: orders.filter((o) => o.status === 'ready').length,
    all: orders.length,
  };

  return (
    <>
      <div className="row-between">
        <div>
          <h2>Orders inbox</h2>
          <p>Live — new customer orders appear here instantly.</p>
        </div>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="chip-row" role="tablist" aria-label="Order states">
        {(Object.keys(TAB_STATUS) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`isla-btn isla-btn-sm ${tab === t ? 'isla-btn-primary' : 'isla-btn-secondary'}`}
            onClick={() => setTab(t)}
          >
            {t === 'new' ? 'New' : t === 'preparing' ? 'Preparing' : t === 'ready' ? 'Ready' : 'All'} ({counts[t]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="isla-card"><p>Loading orders…</p></div>
      ) : visible.length === 0 ? (
        <div className="isla-card">
          <h2>Nothing here</h2>
          <p>{tab === 'all' ? 'No orders yet. They will appear here when customers check out.' : `No ${tab} orders right now.`}</p>
        </div>
      ) : (
        <div className="product-grid">
          {visible.map((o) => (
            <div key={o.id} className="isla-card">
              <div className="row-between">
                <span className="product-name">{o.order_number}</span>
                <Badge tone={o.status === 'declined' || o.status === 'cancelled' ? 'bad' : o.status === 'completed' ? 'ok' : o.status === 'awaiting_merchant' ? 'pending' : 'info'}>
                  {o.status.replaceAll('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <p>{FULFILLMENT_LABEL[o.fulfillment_mode] ?? o.fulfillment_mode} · {peso(o.grand_total)}</p>
              <p className="hint">{o.dropoff_notes} · {o.dropoff_address}</p>
              <div className="btn-row">
                <button type="button" className="isla-btn isla-btn-secondary isla-btn-sm" onClick={() => void openDetail(o)}>
                  Details
                </button>
                {o.status === 'awaiting_merchant' ? (
                  <>
                    <button type="button" className="isla-btn isla-btn-primary isla-btn-sm" disabled={acting} onClick={() => void transition(o, 'preparing')}>
                      Accept
                    </button>
                    <button type="button" className="isla-btn isla-btn-danger isla-btn-sm" disabled={acting} onClick={() => void transition(o, 'declined')}>
                      Decline
                    </button>
                  </>
                ) : null}
                {o.status === 'preparing' ? (
                  <button type="button" className="isla-btn isla-btn-primary isla-btn-sm" disabled={acting} onClick={() => void transition(o, 'ready')}>
                    Mark ready
                  </button>
                ) : null}
                {o.status === 'ready' ? (
                  <button type="button" className="isla-btn isla-btn-primary isla-btn-sm" disabled={acting} onClick={() => void transition(o, 'completed')}>
                    Complete
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected ? (
        <OrderDetail
          order={selected}
          items={items}
          timeline={timeline}
          onClose={() => setSelected(null)}
          onTransition={(s) => void transition(selected, s)}
          acting={acting}
        />
      ) : null}
    </>
  );
}

function OrderDetail({
  order,
  items,
  timeline,
  onClose,
  onTransition,
  acting,
}: {
  order: OrderRow;
  items: OrderItem[];
  timeline: StatusLog[];
  onClose: () => void;
  onTransition: (s: OrderRow['status']) => void;
  acting: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-sheet" role="dialog" aria-modal="true" aria-label={`Order ${order.order_number}`} onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2>{order.order_number}</h2>
          <button type="button" className="isla-btn isla-btn-secondary isla-btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <p>{FULFILLMENT_LABEL[order.fulfillment_mode] ?? order.fulfillment_mode} · {peso(order.grand_total)}</p>
        <p className="hint">{order.dropoff_notes} · {order.dropoff_address}</p>
        <h2>Items</h2>
        {items.map((it) => (
          <div key={it.id} className="row-between">
            <span>{it.quantity}× {it.name}</span>
            <span>{it.estimated_price != null ? peso(Number(it.estimated_price) * it.quantity) : ''}</span>
          </div>
        ))}
        <h2>Timeline</h2>
        {timeline.length === 0 ? (
          <p className="hint">No transitions logged yet.</p>
        ) : (
          timeline.map((t) => (
            <p key={t.id} className="hint">
              {t.status.replaceAll('_', ' ')} · {new Date(t.created_at).toLocaleString()}
            </p>
          ))
        )}
        <div className="btn-row">
          {order.status === 'awaiting_merchant' ? (
            <>
              <button type="button" className="isla-btn isla-btn-primary isla-btn-sm" disabled={acting} onClick={() => onTransition('preparing')}>
                Accept & prepare
              </button>
              <button type="button" className="isla-btn isla-btn-danger isla-btn-sm" disabled={acting} onClick={() => onTransition('declined')}>
                Decline (store busy)
              </button>
            </>
          ) : null}
          {order.status === 'preparing' ? (
            <button type="button" className="isla-btn isla-btn-primary isla-btn-sm" disabled={acting} onClick={() => onTransition('ready')}>
              Mark ready — notify customer
            </button>
          ) : null}
          {order.status === 'ready' ? (
            <button type="button" className="isla-btn isla-btn-primary isla-btn-sm" disabled={acting} onClick={() => onTransition('completed')}>
              Complete (handed over — ask for the order number)
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
