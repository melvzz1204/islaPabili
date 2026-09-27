import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Database } from '@isla/supabase';
import { supabase } from '../lib/supabase';
import { formatDateTime, townSummary } from '../lib/format';
import { Badge } from '../components/ui';

type Application = Database['public']['Tables']['rider_applications']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export type RiderRow = { application: Application; profile: Profile | null };

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

const TONE: Record<Application['status'], 'pending' | 'ok' | 'bad'> = {
  pending: 'pending',
  approved: 'ok',
  rejected: 'bad',
};

export function RiderApplications({ onOpen }: { onOpen: (row: RiderRow) => void }) {
  const [rows, setRows] = useState<RiderRow[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Two queries joined in JS rather than an embedded resource: the generated
    // types carry no relationship metadata for this join yet.
    const { data: applications, error: appError } = await supabase
      .from('rider_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (appError) {
      setError(appError.message);
      setLoading(false);
      return;
    }

    const list = applications ?? [];
    const riderIds = list.map((a) => a.rider_id);
    const byId = new Map<string, Profile>();
    if (riderIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', riderIds);
      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }
      for (const profile of profiles ?? []) byId.set(profile.id, profile);
    }

    setRows(list.map((application) => ({ application, profile: byId.get(application.rider_id) ?? null })));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { pending: 0, approved: 0, rejected: 0, all: rows.length };
    for (const { application } of rows) base[application.status] += 1;
    return base;
  }, [rows]);

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.application.status === filter)),
    [rows, filter],
  );

  return (
    <section className="stack">
      <div className="row-between">
        <div>
          <h1>Rider applications</h1>
          <p>Review documents, approve riders, and send a reason when declining.</p>
        </div>
        <button type="button" className="isla-btn isla-btn-secondary isla-btn-sm" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <div className="chip-row" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`filter-chip ${filter === f.key ? 'filter-chip-active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label} <span className="filter-count">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="isla-card">
          <p>Loading applications…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="isla-card">
          <p>No {filter === 'all' ? '' : `${filter} `}applications right now.</p>
        </div>
      ) : (
        <div className="stack">
          {visible.map((row) => (
            <button
              key={row.application.id}
              type="button"
              className="application-row"
              onClick={() => onOpen(row)}
            >
              <div className="row-between">
                <div className="stack-tight">
                  <strong>{row.profile?.full_name || row.profile?.username || 'Unnamed rider'}</strong>
                  <span className="hint">
                    {row.profile?.phone || row.profile?.email || 'No contact details'}
                  </span>
                </div>
                <Badge tone={TONE[row.application.status]}>{row.application.status.toUpperCase()}</Badge>
              </div>
              <div className="meta-grid">
                <span>
                  <span className="meta-label">Operating area</span>
                  <span className="meta-value">{townSummary(row.application.operating_towns)}</span>
                </span>
                <span>
                  <span className="meta-label">Experience</span>
                  <span className="meta-value">
                    {row.application.driving_experience_years ?? 0} yr
                  </span>
                </span>
                <span>
                  <span className="meta-label">Applied</span>
                  <span className="meta-value">{formatDateTime(row.application.created_at)}</span>
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
