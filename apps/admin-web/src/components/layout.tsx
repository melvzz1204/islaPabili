import { useState } from 'react';
import { signOut } from '@isla/supabase';
import { supabase } from '../lib/supabase';

export type AdminTab = 'dashboard' | 'orders' | 'riders' | 'merchants' | 'customers' | 'finance' | 'settings';

export const NAV: { section: string; items: { key: AdminTab; label: string; icon: string; blurb: string }[] }[] = [
  {
    section: 'Overview',
    items: [{ key: 'dashboard', label: 'Dashboard', icon: '◧', blurb: 'Island-wide pulse' }],
  },
  {
    section: 'Operations',
    items: [
      { key: 'orders', label: 'Orders', icon: '🧾', blurb: 'Live order book' },
      { key: 'riders', label: 'Riders', icon: '🛵', blurb: 'Fleet + applications' },
      { key: 'merchants', label: 'Merchants', icon: '🏪', blurb: 'Stores & catalog' },
    ],
  },
  {
    section: 'Growth',
    items: [
      { key: 'customers', label: 'Customers', icon: '👥', blurb: 'Demand side' },
      { key: 'finance', label: 'Finance', icon: '💠', blurb: 'Money + promos' },
    ],
  },
  {
    section: 'System',
    items: [{ key: 'settings', label: 'Settings', icon: '⚙', blurb: 'Pricing & ops' }],
  },
];

export function Shell({ tab, setTab, email, pendingApps, children }: {
  tab: AdminTab;
  setTab: (t: AdminTab) => void;
  email: string | null;
  pendingApps: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const active = NAV.flatMap((s) => s.items).find((i) => i.key === tab);

  return (
    <div className="shell">
      <aside className={`side ${open ? 'side-open' : ''}`}>
        <div className="side-brand">
          <img src="/islapabili_logo.svg" alt="IslaPabili" />
          <div>
            <strong>IslaPabili</strong>
            <span>Admin console</span>
          </div>
          <span className="live-dot" title="Live" />
        </div>
        <nav className="side-nav">
          {NAV.map((s) => (
            <div key={s.section} className="side-sec">
              <p className="side-cap">{s.section}</p>
              {s.items.map((i) => (
                <button
                  key={i.key}
                  type="button"
                  className={`side-link ${tab === i.key ? 'side-active' : ''}`}
                  onClick={() => { setTab(i.key); setOpen(false); }}
                >
                  <span className="side-ico" aria-hidden>{i.icon}</span>
                  <span className="side-txt">
                    <span>{i.label}</span>
                    <small>{i.blurb}</small>
                  </span>
                  {i.key === 'riders' && pendingApps > 0 ? (
                    <span className="side-badge">{pendingApps}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <div className="admin-chip">
            <span className="avatar">{(email ?? 'A').slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{email ?? 'Admin'}</strong>
              <small>Superadmin · Marinduque</small>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void signOut(supabase)}
          >
            ⎋ Log out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn" onClick={() => setOpen((v) => !v)} aria-label="Menu">☰</button>
          <div className="crumb">
            <span className="crumb-now">{active?.label ?? ''}</span>
            <small>{active?.blurb ?? ''} · {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</small>
          </div>
          <div className="top-actions">
            <span className="net"><span className="pulse" /> Live · Supabase</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>↻ Refresh</button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
      {open ? <div className="scrim" onClick={() => setOpen(false)} /> : null}
    </div>
  );
}
