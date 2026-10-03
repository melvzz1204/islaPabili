import type { ReactNode } from 'react';
import { Icon, type IconName } from './icon';

/* ---------- primitives ---------- */

export function Card({ title, subtitle, action, children, className = '' }: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title ? (
        <div className="panel-head">
          <div>
            <h3 className="panel-title">{title}</h3>
            {subtitle ? <p className="panel-sub">{subtitle}</p> : null}
          </div>
          {action ?? null}
        </div>
      ) : null}
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, hint, delta, tone = 'teal', icon }: {
  label: string;
  value: string;
  hint?: string;
  delta?: string;
  tone?: 'teal' | 'orange' | 'green' | 'red' | 'violet' | 'blue';
  icon?: IconName;
}) {
  return (
    <div className={`kpi kpi-${tone}`}>
      <div className="kpi-top">
        <span className="kpi-icon" aria-hidden><Icon name={icon ?? 'spark'} size={20} /></span>
        {delta ? <span className="kpi-delta">{delta}</span> : null}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {hint ? <div className="kpi-hint">{hint}</div> : null}
    </div>
  );
}

export type BadgeTone = 'pending' | 'ok' | 'bad' | 'info' | 'neutral' | 'violet';

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function statusTone(status: string): BadgeTone {
  if (['completed'].includes(status)) return 'ok';
  if (['cancelled', 'failed', 'declined', 'rejected'].includes(status)) return 'bad';
  if (['pending_dispatch', 'awaiting_merchant', 'pending'].includes(status)) return 'pending';
  if (['ready', 'preparing'].includes(status)) return 'info';
  return 'violet';
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Empty({ icon = 'inbox', title, body, action }: {
  icon?: IconName; title: string; body?: string; action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden><Icon name={icon} size={24} /></span>
      <div className="empty-title">{title}</div>
      {body ? <p className="empty-body">{body}</p> : null}
      {action ?? null}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-wrap" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: `${92 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children, wide }: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div
        className={`sheet ${wide ? 'sheet-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <div>
            <h2 className="sheet-title">{title}</h2>
            {subtitle ? <p className="sheet-sub">{subtitle}</p> : null}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="close" size={14} /> Close</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="kv">
      <span className="kv-k">{label}</span>
      <span className="kv-v">{value}</span>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="search">
      <Icon name="search" size={18} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
      />
      {value ? <button type="button" onClick={() => onChange('')} aria-label="Clear"><Icon name="close" size={14} /></button> : null}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          className={`seg-btn ${value === o.key ? 'seg-active' : ''}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
          {typeof o.count === 'number' ? <span className="seg-count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
