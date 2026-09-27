import { useState } from 'react';
import type { Database } from '@isla/supabase';
import { supabase } from '../lib/supabase';
import { formatDateTime, townName, townSummary } from '../lib/format';
import { Badge, Detail, Field, Modal } from '../components/ui';
import type { RiderRow } from './RiderApplications';

type Application = Database['public']['Tables']['rider_applications']['Row'];

const DOC_BUCKET = 'onboarding-docs';
const SIGNED_URL_TTL_SECONDS = 300;

const TONE: Record<Application['status'], 'pending' | 'ok' | 'bad'> = {
  pending: 'pending',
  approved: 'ok',
  rejected: 'bad',
};

export function RiderReview({
  row,
  onBack,
  onReviewed,
}: {
  row: RiderRow;
  onBack: () => void;
  onReviewed: () => void;
}) {
  const { application, profile } = row;
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(application.admin_notes ?? '');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const documents: { label: string; path: string | null }[] = [
    { label: "Driver's License (front)", path: application.driver_license_front_url },
    { label: "Driver's License (back)", path: application.driver_license_back_url },
    { label: 'Rider profile photo', path: application.rider_photo_url },
  ];

  const decide = async (decision: 'approved' | 'rejected', why?: string) => {
    setBusy(decision === 'approved' ? 'approve' : 'reject');
    setError(null);
    setNotice(null);
    const { error: rpcError } = await supabase.rpc('review_rider_application', {
      p_application_id: application.id,
      p_decision: decision,
      p_reason: why ?? null,
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setRejecting(false);
    setNotice(
      decision === 'approved'
        ? 'Approved. The rider has been notified and can now go on duty.'
        : 'Declined. The rider has been notified with your reason.',
    );
    onReviewed();
  };

  const openDocument = async (path: string) => {
    setError(null);
    // The bucket is private, so the stored path is not directly viewable.
    const { data, error: signError } = await supabase.storage
      .from(DOC_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signError) {
      setError(signError.message);
      return;
    }
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const canSubmitRejection = reason.trim().length > 0;

  return (
    <section className="stack">
      <div className="row-between">
        <div>
          <button type="button" className="link-btn" onClick={onBack}>
            ← Back to applications
          </button>
          <h1>{profile?.full_name || profile?.username || 'Unnamed rider'}</h1>
        </div>
        <Badge tone={TONE[application.status]}>{application.status.toUpperCase()}</Badge>
      </div>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="isla-card">
        <h2>Rider profile</h2>
        <div className="detail-grid">
          <Detail label="Full name" value={profile?.full_name || '—'} />
          <Detail label="Username" value={profile?.username || '—'} />
          <Detail label="Email" value={profile?.email || '—'} />
          <Detail label="Phone" value={profile?.phone || '—'} />
          <Detail label="Account role" value={profile?.role || '—'} />
          <Detail label="Home town" value={townName(profile?.home_town)} />
          <Detail label="Browses" value={townSummary(profile?.town_preferences)} />
          <Detail label="Address" value={profile?.address || '—'} />
          <Detail label="Account active" value={profile?.is_active ? 'Yes' : 'No'} />
          <Detail label="Joined" value={formatDateTime(profile?.created_at)} />
        </div>
      </div>

      <div className="isla-card">
        <h2>Application</h2>
        <div className="detail-grid">
          <Detail label="Operating area" value={townSummary(application.operating_towns)} />
          <Detail label="Driving experience" value={`${application.driving_experience_years ?? 0} years`} />
          <Detail label="Applied" value={formatDateTime(application.created_at)} />
          <Detail label="Reference" value={application.id.slice(0, 8)} />
          <Detail label="Reviewed" value={application.reviewed_at ? formatDateTime(application.reviewed_at) : '—'} />
          <Detail label="Admin notes" value={application.admin_notes || '—'} />
        </div>
      </div>

      <div className="isla-card">
        <h2>Compliance documents</h2>
        <p className="hint">Links are signed and expire after 5 minutes.</p>
        <div className="doc-list">
          {documents.map((doc) => (
            <div key={doc.label} className="doc-row">
              <div className="stack-tight">
                <strong>{doc.label}</strong>
                <span className="hint">{doc.path ? 'Attached' : 'Not provided'}</span>
              </div>
              {doc.path ? (
                <button
                  type="button"
                  className="isla-btn isla-btn-secondary isla-btn-sm"
                  onClick={() => void openDocument(doc.path as string)}
                >
                  View
                </button>
              ) : (
                <Badge tone="bad">MISSING</Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      {application.status === 'pending' ? (
        <div className="isla-card">
          <h2>Decision</h2>
          <p>
            Approving promotes the rider and notifies them. Declining requires a reason — the rider
            receives it verbatim in their notifications.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="isla-btn isla-btn-primary"
              disabled={busy !== null}
              onClick={() => void decide('approved')}
            >
              {busy === 'approve' ? 'Approving…' : 'Approve rider'}
            </button>
            <button
              type="button"
              className="isla-btn isla-btn-danger"
              disabled={busy !== null}
              onClick={() => setRejecting(true)}
            >
              Decline…
            </button>
          </div>
        </div>
      ) : (
        <div className="isla-card">
          <h2>Decision</h2>
          <p>
            This application was {application.status} on {formatDateTime(application.reviewed_at)}.
            {application.admin_notes ? ` Reason given: “${application.admin_notes}”` : ''}
          </p>
        </div>
      )}

      {rejecting ? (
        <Modal title="Decline application" onClose={() => setRejecting(false)}>
          <p className="hint">
            The rider sees this reason in their notifications, so be specific about what needs to
            change.
          </p>
          <Field label="Reason for rejection">
            <textarea
              className="isla-input"
              rows={4}
              placeholder="e.g. The back of your driver's license is not readable. Please retake it in daylight."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className="btn-row">
            <button
              type="button"
              className="isla-btn isla-btn-danger"
              disabled={!canSubmitRejection || busy !== null}
              onClick={() => void decide('rejected', reason.trim())}
            >
              {busy === 'reject' ? 'Sending…' : 'Decline and notify rider'}
            </button>
            <button type="button" className="isla-btn isla-btn-secondary" onClick={() => setRejecting(false)}>
              Cancel
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
