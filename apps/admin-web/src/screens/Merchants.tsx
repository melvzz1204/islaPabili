import { useMemo, useState } from 'react';
import type { AdminData } from '../lib/adminData';
import { sumBy } from '../lib/analytics';
import { num, peso } from '../lib/currency';
import { formatDateTime } from '../lib/format';
import { Badge, Card, Detail, Empty, Modal, SearchInput, Skeleton } from '../components/ui';
import { supabase } from '../lib/supabase';

export function Merchants({ data, loading, reload }: { data: AdminData; loading: boolean; reload: () => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const merchant = data.merchants.find((m) => m.id === sel) ?? null;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.merchants.filter((m) => {
      if (cat !== 'all' && m.category !== cat) return false;
      if (needle && !`${m.name} ${m.town} ${m.address ?? ''}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data.merchants, q, cat]);

  const stats = (id: string) => {
    const orders = data.orders.filter((o) => o.merchant_id === id);
    const products = data.products.filter((p) => p.merchant_id === id);
    return { orders: orders.length, gmv: sumBy(orders, (o) => o.grand_total), products: products.length, active: products.filter((p) => p.is_active).length };
  };

  const toggle = async (id: string, next: boolean) => {
    setBusy(true);
    const { error } = await supabase.from('merchants').update({ is_active: next }).eq('id', id);
    setBusy(false);
    if (!error) reload();
  };

  if (loading) return <Card title="Merchants"><Skeleton lines={6} /></Card>;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="eyebrow">Operations · supply</p>
          <h1 className="hero-title">Merchants</h1>
          <p className="hero-sub">{num(data.merchants.filter((m) => m.is_active).length)} active stores · {num(data.products.length)} SKUs across the island.</p>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search stores, towns…" />
      </div>
      <Card>
        <div className="toolbar">
          <div className="seg seg-sm">
            {['all', 'fast_food', 'grocery', 'drugstore', 'local'].map((c) => (
              <button key={c} type="button" className={`seg-btn ${cat === c ? 'seg-active' : ''}`} onClick={() => setCat(c)}>
                {c === 'all' ? 'All' : c.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        <div className="store-grid">
          {rows.map((m) => {
            const s = stats(m.id);
            return (
              <button key={m.id} type="button" className={`store-card ${m.is_active ? '' : 'off'}`} onClick={() => setSel(m.id)}>
                <div className="store-top">
                  <span className="store-logo">{m.name.slice(0, 1)}</span>
                  <span><strong>{m.name}</strong><small>{m.town} · {m.category.replace('_', ' ')}</small></span>
                  {m.is_active ? <Badge tone="ok">LIVE</Badge> : <Badge tone="neutral">PAUSED</Badge>}
                </div>
                <div className="store-stats">
                  <span><strong>{peso(s.gmv)}</strong><small>GMV</small></span>
                  <span><strong>{num(s.orders)}</strong><small>orders</small></span>
                  <span><strong>{s.active}/{s.products}</strong><small>SKUs live</small></span>
                </div>
              </button>
            );
          })}
        </div>
        {rows.length === 0 ? <Empty icon="🏪" title="No stores match" body="Try a different category or search." /> : null}
      </Card>

      {merchant ? (
        <Modal title={merchant.name} subtitle={`${merchant.town} · ${merchant.category} · since ${formatDateTime(merchant.created_at)}`} onClose={() => setSel(null)} wide>
          <MerchantDetail data={data} id={merchant.id} busy={busy} onToggle={toggle} />
        </Modal>
      ) : null}
    </div>
  );
}

function MerchantDetail({ data, id, busy, onToggle }: {
  data: AdminData; id: string; busy: boolean; onToggle: (id: string, next: boolean) => void;
}) {
  const m = data.merchants.find((x) => x.id === id);
  const products = data.products.filter((p) => p.merchant_id === id);
  const orders = data.orders.filter((o) => o.merchant_id === id);
  if (!m) return null;
  return (
    <div className="stack">
      <div className="detail-grid">
        <Detail label="Status" value={m.is_active ? <Badge tone="ok">LIVE</Badge> : <Badge tone="neutral">PAUSED</Badge>} />
        <Detail label="GMV (recent 600)" value={peso(sumBy(orders, (o) => o.grand_total))} />
        <Detail label="Orders" value={num(orders.length)} />
        <Detail label="Catalog" value={`${products.filter((p) => p.is_active).length}/${products.length} live`} />
        <Detail label="Address" value={m.address || '—'} />
        <Detail label="Phone" value={m.phone || '—'} />
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onToggle(m.id, !m.is_active)}>
          {m.is_active ? '⏸ Pause store' : '▶ Set live'}
        </button>
      </div>
      <div className="panel-soft">
        <h4>Catalog ({products.length})</h4>
        {products.length === 0 ? <p className="muted">No products synced for this store yet.</p> : (
          <ul className="lines">
            {products.slice(0, 20).map((p) => (
              <li key={p.id}>
                <span>{p.is_active ? '🟢' : '⚪'} {p.name} <small>· {p.category} · stock {p.stock}</small></span>
                <strong>{peso(p.price)}</strong>
              </li>
            ))}
          </ul>
        )}
        {products.length > 20 ? <p className="muted">Showing 20 of {products.length}.</p> : null}
      </div>
    </div>
  );
}
