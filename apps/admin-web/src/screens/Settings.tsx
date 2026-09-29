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
  const [relVersion, setRelVersion] = useState('');
  const [relBuild, setRelBuild] = useState('');
  const [relMin, setRelMin] = useState('');
  const [relUrl, setRelUrl] = useState('');
  const [relNotes, setRelNotes] = useState('');
  const [relMsg, setRelMsg] = useState<string | null>(null);
  const [relBusy, setRelBusy] = useState(false);

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

  const latestRelease = data.releases[0] ?? null;

  const publishRelease = async () => {
    const build = Number(relBuild);
    if (!relVersion.trim() || !Number.isFinite(build) || build <= 0) {
      setRelMsg('Version and a positive build number are required.');
      return;
    }
    if (!relUrl.trim()) {
      setRelMsg('A download URL (APK link from the EAS build page) is required.');
      return;
    }
    setRelBusy(true); setRelMsg(null);
    const { error: offError } = await supabase
      .from('app_releases')
      .update({ is_active: false })
      .eq('platform', 'android')
      .eq('is_active', true);
    const { error } = offError ? { error: offError } : await supabase.from('app_releases').insert({
      platform: 'android',
      version: relVersion.trim(),
      build_number: build,
      notes: relNotes.trim(),
      apk_url: relUrl.trim(),
      min_build: relMin ? Number(relMin) : 0,
      is_active: true,
    });
    setRelBusy(false);
    setRelMsg(error ? error.message : `Release v${relVersion.trim()} (build ${build}) published — apps on older builds will prompt.`);
    if (!error) { setRelVersion(''); setRelBuild(''); setRelMin(''); setRelUrl(''); setRelNotes(''); reload(); }
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
      <Card title="App releases" subtitle="Publish a build to prompt users with What's new + download">
        <div className="detail-grid">
          <Detail label="Live release" value={latestRelease ? `v${latestRelease.version} · build ${latestRelease.build_number}` : '—'} />
          <Detail label="Min build" value={latestRelease ? String(latestRelease.min_build) : '—'} />
          <Detail label="Published" value={latestRelease ? new Date(latestRelease.created_at).toLocaleString('en-PH') : '—'} />
          <Detail label="Releases" value={num(data.releases.length)} />
        </div>
        <div className="form-row">
          <Field label="Version"><input className="input" value={relVersion} onChange={(e) => setRelVersion(e.target.value)} placeholder="0.2.0" /></Field>
          <Field label="Build number"><input className="input" type="number" value={relBuild} onChange={(e) => setRelBuild(e.target.value)} placeholder="2" /></Field>
          <Field label="Min build (force)"><input className="input" type="number" value={relMin} onChange={(e) => setRelMin(e.target.value)} placeholder="0 = optional" /></Field>
          <Field label="APK download URL"><input className="input" value={relUrl} onChange={(e) => setRelUrl(e.target.value)} placeholder="https://expo.dev/artifacts/…" /></Field>
        </div>
        <Field label="What's new (one per line)"><textarea className="input" rows={3} value={relNotes} onChange={(e) => setRelNotes(e.target.value)} placeholder={'Faster rider tracking\nNew chat design'} /></Field>
        <button type="button" className="btn btn-primary" disabled={relBusy} onClick={() => void publishRelease()}>{relBusy ? 'Publishing…' : 'Publish release'}</button>
        {relMsg ? <p className="notice">{relMsg}</p> : null}
        {data.releases.length > 0 ? (
          <ul className="attention">
            {data.releases.slice(0, 5).map((r) => (
              <li key={r.id}>
                <span><strong>v{r.version} · build {r.build_number}</strong><small>{r.is_active ? 'live' : 'retired'} · min {r.min_build} · {new Date(r.created_at).toLocaleString('en-PH')}</small></span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
