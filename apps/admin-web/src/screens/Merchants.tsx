import { useMemo, useState } from 'react';
import type { AdminData, MerchantApp } from '../lib/adminData';
import { profileById } from '../lib/adminData';
import { sumBy } from '../lib/analytics';
import { num, peso } from '../lib/currency';
import { formatDateTime } from '../lib/format';
import { Badge, Card, Detail, Empty, Field, Modal, SearchInput, Segmented, Skeleton, statusTone } from '../components/ui';
import { Icon } from '../components/icon';
import { supabase } from '../lib/supabase';

type Tab = 'stores' | 'applications';

export function Merchants({ data, loading, reload }: { data: AdminData; loading: boolean; reload: () => void }) {
  const [tab, setTab] = useState<Tab>('stores');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const merchant = data.merchants.find((m) => m.id === sel) ?? null;
  const review = data.merchantApps.find((a) => a.id === reviewId) ?? null;
  const pending = data.merchantApps.filter((a) => a.status === 'pending').length;

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
          <p className="hero-sub">{num(data.merchants.filter((m) => m.is_active).length)} active stores · {num(data.products.length)} SKUs · {num(pending)} applications pending.</p>
        </div>
        {tab === 'stores' ? (
          <SearchInput value={q} onChange={setQ} placeholder="Search stores, towns…" />
        ) : null}
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { key: 'stores', label: 'Stores', count: data.merchants.length },
          { key: 'applications', label: 'Applications', count: data.merchantApps.length },
        ]}
      />

      {tab === 'stores' ? (
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
                  {m.logo_url ? (
                    <img src={supabase.storage.from('store-logos').getPublicUrl(m.logo_url).data.publicUrl} alt="" className="store-logo-img" />
                  ) : (
                    <span className="store-logo">{m.name.slice(0, 1)}</span>
                  )}
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
        {rows.length === 0 ? <Empty icon="store" title="No stores match" body="Try a different category or search." /> : null}
      </Card>
      ) : (
        <StoreApplications data={data} onOpen={setReviewId} />
      )}

      {merchant ? (
        <Modal title={merchant.name} subtitle={`${merchant.town} · ${merchant.category} · since ${formatDateTime(merchant.created_at)}`} onClose={() => setSel(null)} wide>
          <MerchantDetail data={data} id={merchant.id} busy={busy} onToggle={toggle} />
        </Modal>
      ) : null}

      {review ? (
        <Modal title={review.store_name} subtitle={`Applied ${formatDateTime(review.created_at)} · ${review.status}`} onClose={() => setReviewId(null)} wide>
          <MerchantReviewBody app={review} data={data} onDone={() => { setReviewId(null); reload(); }} />
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
          {m.is_active ? <><Icon name="pause" size={14} /> Pause store</> : <><Icon name="play" size={14} /> Set live</>}
        </button>
      </div>
      <div className="panel-soft">
        <h4>Catalog ({products.length})</h4>
        {products.length === 0 ? <p className="muted">No products synced for this store yet.</p> : (
          <ul className="lines">
            {products.slice(0, 20).map((p) => (
              <li key={p.id}>
                <span><span className={`dot ${p.is_active ? 'dot-on' : 'dot-off'}`} /> {p.name} <small>· {p.category} · stock {p.stock}</small></span>
                <strong>{peso(p.price)}</strong>
              </li>
            ))}
          </ul>
        )}
        {products.length > 20 ? <p className="muted">Showing 20 of {products.length}.</p> : null}
      </div>
      <div className="panel-soft">
        <h4>Recent orders ({orders.length})</h4>
        {orders.length === 0 ? <p className="muted">No orders for this store in the loaded window yet.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead>
              <tbody>
                {orders.slice(0, 20).map((o) => {
                  const c = profileById(data.profiles, o.customer_id);
                  return (
                    <tr key={o.id}>
                      <td><strong>{o.order_number}</strong><small>{o.fulfillment_mode?.replace(/_/g, ' ') ?? ''}</small></td>
                      <td>{formatDateTime(o.created_at)}</td>
                      <td>{c?.full_name || c?.username || '—'}<small>{c?.phone ?? ''}</small></td>
                      <td><Badge tone={statusTone(o.status)}>{o.status.replace(/_/g, ' ').toUpperCase()}</Badge></td>
                      <td><strong>{peso(Number(o.grand_total ?? 0))}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {orders.length > 20 ? <p className="muted">Showing 20 of {orders.length}.</p> : null}
      </div>
    </div>
  );
}

function StoreApplications({ data, onOpen }: { data: AdminData; onOpen: (id: string) => void }) {
  const [f, setF] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const rows = data.merchantApps.filter((a) => f === 'all' || a.status === f);
  const count = (s: string) => s === 'all' ? data.merchantApps.length : data.merchantApps.filter((a) => a.status === s).length;
  return (
    <Card
      title="Store applications"
      subtitle="Review the storefront, owner and permit — approve to go live"
      action={<Segmented value={f} onChange={setF} options={(['pending', 'approved', 'rejected', 'all'] as const).map((k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1), count: count(k) }))} />}
    >
      {rows.length === 0 ? <Empty icon="clipboard" title={`No ${f} applications`} body="New store registrations land here for review." /> : (
        <div className="app-grid">
          {rows.map((a) => {
            const p = profileById(data.profiles, a.applicant_id);
            return (
              <button key={a.id} type="button" className="app-card" onClick={() => onOpen(a.id)}>
                <div className="app-top">
                  {a.logo_url ? (
                    <img src={supabase.storage.from('store-logos').getPublicUrl(a.logo_url).data.publicUrl} alt="" className="store-logo-img sm" />
                  ) : (
                    <span className="avatar">{(a.store_name ?? 'S').slice(0, 1)}</span>
                  )}
                  <span><strong>{a.store_name}</strong><small>{a.owner_name || p?.full_name || p?.email || ''}</small></span>
                  <Badge tone={a.status === 'pending' ? 'pending' : a.status === 'approved' ? 'ok' : 'bad'}>{a.status.toUpperCase()}</Badge>
                </div>
                <div className="meta-grid">
                  <span><span className="meta-label">Town</span><span className="meta-value">{a.town}</span></span>
                  <span><span className="meta-label">Category</span><span className="meta-value">{a.category.replace('_', ' ')}</span></span>
                  <span><span className="meta-label">Applied</span><span className="meta-value">{formatDateTime(a.created_at)}</span></span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function MerchantReviewBody({ app, data, onDone }: { app: MerchantApp; data: AdminData; onDone: () => void }) {
  const profile = profileById(data.profiles, app.applicant_id);
  const [reason, setReason] = useState(app.admin_notes ?? '');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permitUrl, setPermitUrl] = useState<string | null>(null);

  const openPermit = async () => {
    if (!app.business_permit_url) return;
    setError(null);
    const { data: signed, error: signError } = await supabase.storage.from('onboarding-docs').createSignedUrl(app.business_permit_url, 300);
    if (signError) { setError(signError.message); return; }
    if (signed?.signedUrl) {
      setPermitUrl(signed.signedUrl);
      window.open(signed.signedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const decide = async (decision: 'approved' | 'rejected') => {
    setBusy(decision === 'approved' ? 'approve' : 'reject');
    setError(null);
    const { error: updateError } = await supabase
      .from('merchant_applications')
      .update({
        status: decision,
        admin_notes: decision === 'rejected' ? reason.trim() || null : app.admin_notes,
      })
      .eq('id', app.id);
    setBusy(null);
    if (updateError) { setError(updateError.message); return; }
    onDone();
  };

  return (
    <div className="stack">
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="detail-grid">
        <Detail label="Store name" value={app.store_name} />
        <Detail label="Owner" value={app.owner_name || profile?.full_name || '—'} />
        <Detail label="Phone" value={app.phone || profile?.phone || '—'} />
        <Detail label="Email" value={profile?.email || '—'} />
        <Detail label="Town" value={app.town} />
        <Detail label="Category" value={app.category.replace('_', ' ')} />
        <Detail label="Address" value={app.address || '—'} />
        <Detail label="Applied" value={formatDateTime(app.created_at)} />
      </div>
      {app.description ? (
        <div className="panel-soft">
          <h4>Store description</h4>
          <p className="muted">{app.description}</p>
        </div>
      ) : null}
      <div className="panel-soft">
        <h4>Store logo & permit</h4>
        <div className="doc-list">
          <div className="doc-row">
            <span>
              {app.logo_url ? (
                <img
                  src={supabase.storage.from('store-logos').getPublicUrl(app.logo_url).data.publicUrl}
                  alt="Store logo"
                  style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, display: 'block' }}
                />
              ) : (
                <span className="muted">No logo uploaded</span>
              )}
              <small>Shown to customers</small>
            </span>
            {!app.logo_url ? <Badge tone="bad">MISSING</Badge> : null}
          </div>
          <div className="doc-row">
            <span><strong>Business permit</strong><small>{app.business_permit_url ? 'Attached' : 'Not provided'}</small></span>
            {app.business_permit_url ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void openPermit()}>View</button>
            ) : (
              <Badge tone="neutral">OPTIONAL</Badge>
            )}
          </div>
        </div>
        {permitUrl ? <p className="muted">Permit link opened in a new tab — signed links expire in 5 min.</p> : null}
      </div>
      {app.status === 'pending' ? (
        <div className="panel-soft">
          <h4>Decision</h4>
          <Field label="Reason (required to decline)">
            <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Permit unreadable — please re-upload a clearer photo." />
          </Field>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void decide('approved')}>
              <Icon name="check" size={15} /> {busy === 'approve' ? 'Approving…' : 'Approve store'}
            </button>
            <button type="button" className="btn btn-danger" disabled={busy !== null || !reason.trim()} onClick={() => void decide('rejected')}>
              {busy === 'reject' ? 'Sending…' : 'Decline'}
            </button>
          </div>
        </div>
      ) : (
        <p className="muted">Decided {app.status}{app.reviewed_at ? ` on ${formatDateTime(app.reviewed_at)}` : ''}{app.admin_notes ? ` — “${app.admin_notes}”` : ''}.</p>
      )}
    </div>
  );
}
