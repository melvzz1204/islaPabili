import type { ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="isla-label">
      {label}
      {children}
    </label>
  );
}

export function Badge({ tone, children }: { tone: 'pending' | 'ok' | 'bad' | 'info'; children: ReactNode }) {
  return <span className={`isla-badge isla-badge-${tone}`}>{children}</span>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row-between">
          <h2>{title}</h2>
          <button type="button" className="isla-btn isla-btn-secondary isla-btn-sm" onClick={onClose} aria-label="Close dialog">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Label/value row used throughout the review detail. */
export function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="detail">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
