import { useState } from 'react';
import type { AdminData } from '../lib/adminData';
import { sumBy } from '../lib/analytics';
import { num, peso } from '../lib/currency';
import { Badge, Card, Detail, Field } from '../components/ui';
import { supabase } from '../lib/supabase';

export function Settings({ data, reload }: { data: AdminData; reload: () => void }) {
  const active = data.fares.find((f) => f.is_active) ?? data.fares[0];
  const [base, setBase] = useState('');
  const [perKm, setPerKm] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('fare_config').insert({
      base_fare: base ? Number(base) : (active?.base_fare ?? 40),
      per_km_rate: perKm ? Number(perKm) : (active?.per_km_rate ?? 10),
      base_km: active?.base_km ?? 2,
      name: `Console update ${new Date().toLocaleString('en-PH')}`,
      is_active: true,
    });
    setBusy(false);
    setMsg(error ? error.message : 'Fare updated. New checkouts quote from this config.');
    if (!error) { setBase(''); setPerKm(''); reload(); }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="eyebrow">System · control room</p>
          <h1 className="hero-title">Settings</h1>
          <p className="hero-sub">Pricing, coverage and platform health at a glance.</p>
        </div>
      </div>
      <div className="grid-2">
        <Card title="Delivery pricing" subtitle="Base + per-km · changes version, never overwrite">
          <div className="detail-grid">
            <Detail label="Base fare" value={peso(active?.base_fare ?? 40)} />
            <Detail label="Per km" value={peso(active?.per_km_rate ?? 10)} />
            <Detail label="Base km" value={String(active?.base_km ?? 2)} />
            <Detail label="Active config" value={active?.name ?? 'Default'} />
          </div>
          <div className="form-row">
            <Field label="New base fare"><input className="input" type="number" value={base} onChange={(e) => setBase(e.target.value)} placeholder="40" /></Field>
            <Field label="New per-km"><input className="input" type="number" value={perKm} onChange={(e) => setPerKm(e.target.value)} placeholder="10" /></Field>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Publish'}</button>
          </div>
          {msg ? <p className="notice">{msg}</p> : null}
        </Card>
        <Card title="Platform health" subtitle="What the console is reading">
          <div className="detail-grid">
            <Detail label="Orders (window)" value={num(data.orders.length)} />
            <Detail label="Profiles" value={num(data.profiles.length)} />
            <Detail label="Merchants" value={num(data.merchants.length)} />
            <Detail label="Products" value={num(data.products.length)} />
            <Detail label="GMV (completed)" value={peso(sumBy(data.orders.filter((o) => o.status === 'completed'), (o) => o.grand_total))} />
            <Detail label="RLS" value={<Badge tone="ok">ADMIN READ · ENFORCED</Badge>} />
          </div>
          <p className="muted">Destructive actions are intentionally absent — pause instead of delete so the audit trail stays intact.</p>
        </Card>
      </div>
    </div>
  );
}
