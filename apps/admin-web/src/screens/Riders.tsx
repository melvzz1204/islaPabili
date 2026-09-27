import { useMemo, useState } from 'react';
import { TOWN_LABELS } from '@isla/shared';
import type { AdminData } from '../lib/adminData';
import { profileById } from '../lib/adminData';
import { avgRating } from '../lib/analytics';
import { num } from '../lib/currency';
import { formatDateTime, townSummary } from '../lib/format';
import { Badge, Card, Detail, Empty, Field, Modal, SearchInput, Segmented, Skeleton } from '../components/ui';
import { supabase } from '../lib/supabase';

type Tab = 'fleet' | 'applications' | 'ratings';

export function Riders({ data, loading, reload }: { data: AdminData; loading: boolean; reload: () => void }) {
  const [tab, setTab] = useState<Tab>('fleet');
  const [q, setQ] = useState('');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const review = data.riderApps.find((a) => a.id === reviewId) ?? null;

  const riders = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.profiles.filter((p) => {
      if (p.role !== 'rider') return false;
      if (needle && !`${p.full_name} ${p.username} ${p.phone} ${p.email}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data.profiles, q]);

  const pending = data.riderApps.filter((a) => a.status === 'pending').length;

  if (loading) return <Card title="Riders"><Skeleton lines={6} /></Card>;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="eyebrow">Operations · fleet</p>
          <h1 className="hero-title">Riders</h1>
          <p className="hero-sub">{num(data.riderStatus.filter((r) => r.on_duty).length)} on duty · {num(riders.length)} riders · {num(pending)} applications pending.</p>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search rider name, phone…" />
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { key: 'fleet', label: 'Fleet', count: riders.length },
          { key: 'applications', label: 'Applications', count: data.riderApps.length },
          { key: 'ratings', label: 'Ratings', count: data.ratings.length },
        ]}
      />

      {tab === 'fleet' ? <Fleet data={data} riders={riders} /> : null}
      {tab === 'applications' ? (
        <Applications data={data} onOpen={setReviewId} />
      ) : null}
      {tab === 'ratings' ? (
        <Card title="Rider ratings" subtitle="Post-delivery reviews from customers">
          {data.ratings.length === 0 ? <Empty icon="★" title="No reviews yet" body="Ratings appear here after completed deliveries." /> : (
            <ul className="attention">
              {data.ratings.slice(0, 30).map((r) => {
                const rider = profileById(data.profiles, r.rider_id);
                return (
                  <li key={r.id}>
                    <span className="stars">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</span>
                    <span><strong>{rider?.full_name || rider?.username || 'Rider'}</strong><small>{r.comment || 'No comment'} · {formatDateTime(r.created_at)}</small></span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      {review ? (
        <Modal title={profileById(data.profiles, review.rider_id)?.full_name || 'Rider application'} subtitle={`Applied ${formatDateTime(review.created_at)} · ${review.status}`} onClose={() => setReviewId(null)} wide>
          <ReviewBody appId={review.id} data={data} onDone={() => { setReviewId(null); reload(); }} />
        </Modal>
      ) : null}
    </div>
  );
}

function Fleet({ data, riders }: { data: AdminData; riders: AdminData['profiles'] }) {
  const statusOf = (id: string) => data.riderStatus.find((s) => s.rider_id === id);
  const ordersOf = (id: string) => data.orders.filter((o) => o.rider_id === id);
  const ratingOf = (id: string) => avgRating(data.ratings.filter((r) => r.rider_id === id));
  return (
    <Card>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Rider</th><th>Duty</th><th>Town</th><th>Deliveries</th><th>Rating</th><th>Status</th></tr></thead>
          <tbody>
            {riders.map((p) => {
              const s = statusOf(p.id);
              const os = ordersOf(p.id);
              const done = os.filter((o) => o.status === 'completed').length;
              const r = ratingOf(p.id);
              return (
                <tr key={p.id}>
                  <td><strong>{p.full_name || p.username || 'Unnamed'}</strong><small>{p.phone ?? p.email ?? ''}</small></td>
                  <td>{s?.on_duty ? <Badge tone="ok">ON DUTY</Badge> : <Badge tone="neutral">OFF</Badge>}</td>
                  <td>{s?.current_town ? TOWN_LABELS[s.current_town] : '—'}<small>last seen {s ? formatDateTime(s.last_seen_at) : '—'}</small></td>
                  <td><strong>{num(done)}</strong><small>{num(os.length)} assigned</small></td>
                  <td>{r ? `★ ${r.toFixed(1)}` : '—'}</td>
                  <td>{p.is_active ? <Badge tone="ok">ACTIVE</Badge> : <Badge tone="bad">PAUSED</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {riders.length === 0 ? <Empty icon="🛵" title="No riders found" body="Approved riders will appear in the fleet board." /> : null}
      </div>
    </Card>
  );
}

function Applications({ data, onOpen }: { data: AdminData; onOpen: (id: string) => void }) {
  const [f, setF] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const rows = data.riderApps.filter((a) => f === 'all' || a.status === f);
  const count = (s: string) => s === 'all' ? data.riderApps.length : data.riderApps.filter((a) => a.status === s).length;
  return (
    <Card
      title="Rider applications"
      subtitle="Compliance review — approve to promote, decline with a reason"
      action={<Segmented value={f} onChange={setF} options={(['pending', 'approved', 'rejected', 'all'] as const).map((k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1), count: count(k) }))} />}
    >
      {rows.length === 0 ? <Empty icon="📋" title={`No ${f} applications`} body="New rider sign-ups land here for review." /> : (
        <div className="app-grid">
          {rows.map((a) => {
            const p = profileById(data.profiles, a.rider_id);
            return (
              <button key={a.id} type="button" className="app-card" onClick={() => onOpen(a.id)}>
                <div className="app-top">
                  <span className="avatar">{(p?.full_name ?? 'R').slice(0, 1)}</span>
                  <span><strong>{p?.full_name || p?.username || 'Unnamed rider'}</strong><small>{p?.phone || p?.email || ''}</small></span>
                  <Badge tone={a.status === 'pending' ? 'pending' : a.status === 'approved' ? 'ok' : 'bad'}>{a.status.toUpperCase()}</Badge>
                </div>
                <div className="meta-grid">
                  <span><span className="meta-label">Operating area</span><span className="meta-value">{townSummary(a.operating_towns)}</span></span>
                  <span><span className="meta-label">Experience</span><span className="meta-value">{a.driving_experience_years ?? 0} yr</span></span>
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

function ReviewBody({ appId, data, onDone }: { appId: string; data: AdminData; onDone: () => void }) {
  const app = data.riderApps.find((a) => a.id === appId);
  const profile = app ? profileById(data.profiles, app.rider_id) : undefined;
  const [reason, setReason] = useState(app?.admin_notes ?? '');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!app) return <p className="muted">Application not found.</p>;

  const decide = async (decision: 'approved' | 'rejected') => {
    setBusy(decision === 'approved' ? 'approve' : 'reject');
    setError(null);
    const { error: rpcError } = await supabase.rpc('review_rider_application', {
      p_application_id: app.id,
      p_decision: decision,
      p_reason: decision === 'rejected' ? reason.trim() || null : null,
    });
    setBusy(null);
    if (rpcError) { setError(rpcError.message); return; }
    onDone();
  };

  const docs: { label: string; path: string | null }[] = [
    { label: "Driver's license (front)", path: app.driver_license_front_url },
    { label: "Driver's license (back)", path: app.driver_license_back_url },
    { label: 'Vehicle registration', path: app.vehicle_registration_url },
    { label: 'Vehicle photo', path: app.vehicle_photo_url },
    { label: 'Rider photo', path: app.rider_photo_url },
    { label: 'Helmet photo', path: app.helmet_photo_url },
    { label: 'Barangay clearance', path: app.bg_clearance_url },
  ];

  const openDoc = async (path: string) => {
    setError(null);
    const { data: signed, error: signError } = await supabase.storage.from('onboarding-docs').createSignedUrl(path, 300);
    if (signError) { setError(signError.message); return; }
    if (signed?.signedUrl) window.open(signed.signedUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="stack">
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="detail-grid">
        <Detail label="Full name" value={profile?.full_name || '—'} />
        <Detail label="Phone" value={profile?.phone || '—'} />
        <Detail label="Email" value={profile?.email || '—'} />
        <Detail label="Home town" value={profile?.home_town ? TOWN_LABELS[profile.home_town] : '—'} />
        <Detail label="Operating area" value={townSummary(app.operating_towns)} />
        <Detail label="Experience" value={`${app.driving_experience_years ?? 0} years`} />
      </div>
      <div className="panel-soft">
        <h4>Compliance documents · signed links expire in 5 min</h4>
        <div className="doc-list">
          {docs.map((d) => (
            <div key={d.label} className="doc-row">
              <span><strong>{d.label}</strong><small>{d.path ? 'Attached' : 'Not provided'}</small></span>
              {d.path ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => void openDoc(d.path as string)}>View</button> : <Badge tone="bad">MISSING</Badge>}
            </div>
          ))}
        </div>
      </div>
      {app.status === 'pending' ? (
        <div className="panel-soft">
          <h4>Decision</h4>
          <Field label="Reason (required to decline — rider sees this verbatim)">
            <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Back of license unreadable — retake in daylight." />
          </Field>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void decide('approved')}>{busy === 'approve' ? 'Approving…' : 'Approve rider'}</button>
            <button type="button" className="btn btn-danger" disabled={busy !== null || !reason.trim()} onClick={() => void decide('rejected')}>{busy === 'reject' ? 'Sending…' : 'Decline & notify'}</button>
          </div>
        </div>
      ) : (
        <p className="muted">Decided {app.status} {app.reviewed_at ? `on ${formatDateTime(app.reviewed_at)}` : ''}{app.admin_notes ? ` — “${app.admin_notes}”` : ''}.</p>
      )}
    </div>
  );
}
