import type { Database } from '@isla/supabase';
import { Badge } from '../components/ui';

type Application = Database['public']['Tables']['merchant_applications']['Row'];

export function StatusScreen({ application, onRefresh }: { application: Application; onRefresh: () => void }) {
  const rejected = application.status === 'rejected';
  return (
    <div className="isla-card">
      <Badge tone={rejected ? 'bad' : 'pending'}>{application.status === 'rejected' ? 'REJECTED' : 'PENDING'}</Badge>
      <h1>{rejected ? 'Application not approved' : 'Application under review'}</h1>
      <p>
        {rejected
          ? 'Your application was not approved. Contact support to ask why, or fix the details and re-apply after a decision reset.'
          : `“${application.store_name}” is being verified by an IslaPabili administrator. This usually takes 1–2 business days — your catalog goes live once approved.`}
      </p>
      <div className="btn-row">
        <button type="button" className="isla-btn isla-btn-secondary" onClick={onRefresh}>
          Check status again
        </button>
      </div>
      <p className="hint">Reference: {application.id.slice(0, 8)}</p>
    </div>
  );
}
