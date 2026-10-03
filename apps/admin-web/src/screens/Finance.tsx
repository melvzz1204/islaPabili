import { useMemo, useState } from 'react';
import type { AdminData } from '../lib/adminData';
import { profileById } from '../lib/adminData';
import { sumBy } from '../lib/analytics';
import { num, peso } from '../lib/currency';
import { formatDateTime } from '../lib/format';
import { Badge, Card, Empty, Field, Kpi, SearchInput, Segmented, Skeleton } from '../components/ui';
import { Icon } from '../components/icon';
import { supabase } from '../lib/supabase';

export function Finance({ data, loading, reload }: { data: AdminData; loading: boolean; reload: () => void }) {
  const [tab, setTab] = useState<'money' | 'vouchers' | 'fares'>('money');
  const [q, setQ] = useState('');

  const gmv = sumBy(data.orders.filter((o) => o.status === 'completed'), (o) => o.grand_total);
  const fees = sumBy(data.orders, (o) => o.total_delivery_fee);
  const tips = sumBy(data.orders, (o) => o.tip_amount);
  const settled = sumBy(data.transactions.filter((t) => t.status === 'settled'), (t) => t.amount);
  const cashOnHand = sumBy(data.wallets, (w) => w.cash_on_hand);
  const payout = sumBy(data.wallets, (w) => w.payout_balance);

  const txs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.transactions.filter((t) => {
      if (!needle) return true;
      const r = t.rider_id ? profileById(data.profiles, t.rider_id) : undefined;
      return `${t.kind} ${t.status} ${t.reference ?? ''} ${r?.full_name ?? ''}`.toLowerCase().includes(needle);
    });
  }, [data.transactions, data.profiles, q]);

  if (loading) return <Card title="Finance"><Skeleton lines={6} /></Card>;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="eyebrow">Growth · money</p>
          <h1 className="hero-title">Finance</h1>
          <p className="hero-sub">GMV, rider settlement, promos and pricing — the island ledger.</p>
        </div>
        <Segmented value={tab} onChange={setTab} options={[
          { key: 'money', label: 'Ledger' },
          { key: 'vouchers', label: 'Vouchers', count: data.vouchers.length },
          { key: 'fares', label: 'Fare setup', count: data.fares.length },
        ]} />
      </div>

      <div className="kpi-grid">
        <Kpi tone="teal" icon="peso" label="Completed GMV" value={peso(gmv)} hint="completed orders only" />
        <Kpi tone="blue" icon="route" label="Delivery fees" value={peso(fees)} hint="platform + rider share" />
        <Kpi tone="green" icon="banknote" label="Settled volume" value={peso(settled)} hint={`${num(data.transactions.length)} transactions`} />
        <Kpi tone="orange" icon="coins" label="Cash on hand (riders)" value={peso(cashOnHand)} hint="COD float" />
        <Kpi tone="violet" icon="wallet" label="Payout balance" value={peso(payout)} hint="owed to riders" />
        <Kpi tone="red" icon="ticket" label="Tips paid" value={peso(tips)} hint="100% to riders" />
      </div>

      {tab === 'money' ? (
        <div className="grid-2">
          <Card title="Transactions" subtitle="Settlement bookkeeping" action={<SearchInput value={q} onChange={setQ} placeholder="Search kind, rider…" />}>
            {txs.length === 0 ? <Empty icon="inbox" title="No transactions" body="COD collections, commissions and payouts post here." /> : (
              <ul className="lines">
                {txs.slice(0, 30).map((t) => (
                  <li key={t.id}>
                    <span><strong>{t.kind.replaceAll('_', ' ')}</strong><small>{profileById(data.profiles, t.rider_id)?.full_name ?? '—'} · {formatDateTime(t.created_at)}</small></span>
                    <span className="right"><strong>{peso(t.amount)}</strong><Badge tone={t.status === 'settled' ? 'ok' : t.status === 'failed' ? 'bad' : 'pending'}>{t.status}</Badge></span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Rider wallets" subtitle="COD float vs payout balance">
            {data.wallets.length === 0 ? <Empty icon="wallet" title="No wallets" body="Wallets auto-create on rider activity." /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Rider</th><th>Cash on hand</th><th>Payout</th></tr></thead>
                  <tbody>
                    {data.wallets.slice(0, 20).map((w) => (
                      <tr key={w.id}>
                        <td><strong>{profileById(data.profiles, w.user_id)?.full_name || '—'}</strong></td>
                        <td>{peso(w.cash_on_hand)}</td>
                        <td><strong>{peso(w.payout_balance)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'vouchers' ? <Vouchers data={data} reload={reload} /> : null}
      {tab === 'fares' ? <Fares data={data} reload={reload} /> : null}
    </div>
  );
}

function Vouchers({ data, reload }: { data: AdminData; reload: () => void }) {
  const [form, setForm] = useState({ code: '', name: '', value: '', discount_type: 'fixed' as 'fixed' | 'percent', min_spend: '0' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!form.code.trim() || !form.name.trim() || !Number(form.value)) { setError('Code, name and a value greater than 0 are required.'); return; }
    setBusy(true); setError(null);
    const { error: e } = await supabase.from('vouchers').insert({
      code: form.code.trim().toUpperCase(), name: form.name.trim(),
      value: Number(form.value), discount_type: form.discount_type, min_spend: Number(form.min_spend) || 0,
    });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setForm({ code: '', name: '', value: '', discount_type: 'fixed', min_spend: '0' });
    reload();
  };

  const toggle = async (id: string, next: boolean) => {
    await supabase.from('vouchers').update({ is_active: next }).eq('id', id);
    reload();
  };

  return (
    <Card title="Vouchers & promos" subtitle="Codes apply at checkout with min-spend guards">
      <div className="form-row">
        <Field label="Code"><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ISLA20" /></Field>
        <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rainy-day treat" /></Field>
        <Field label="Value"><input className="input" type="number" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="20" /></Field>
        <Field label="Type">
          <select className="input" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'fixed' | 'percent' })}>
            <option value="fixed">Fixed ₱</option>
            <option value="percent">Percent %</option>
          </select>
        </Field>
        <Field label="Min spend"><input className="input" type="number" min="0" value={form.min_spend} onChange={(e) => setForm({ ...form, min_spend: e.target.value })} /></Field>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void create()}>{busy ? 'Creating…' : <><Icon name="plus" size={15} /> Create</>}</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Code</th><th>Value</th><th>Use</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data.vouchers.map((v) => (
              <tr key={v.id}>
                <td><strong>{v.code}</strong><small>{v.name} · min {peso(v.min_spend)}</small></td>
                <td>{v.discount_type === 'percent' ? `${v.value}%` : peso(v.value)}</td>
                <td>{num(v.used_count)}{v.usage_limit ? `/${num(v.usage_limit)}` : ''}</td>
                <td>{v.is_active ? <Badge tone="ok">ACTIVE</Badge> : <Badge tone="neutral">OFF</Badge>}</td>
                <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => void toggle(v.id, !v.is_active)}>{v.is_active ? 'Pause' : 'Enable'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.vouchers.length === 0 ? <Empty icon="ticket" title="No vouchers yet" body="Create your first island promo above." /> : null}
      </div>
    </Card>
  );
}

function Fares({ data, reload }: { data: AdminData; reload: () => void }) {
  const active = data.fares.find((f) => f.is_active) ?? data.fares[0];
  const [form, setForm] = useState({ base_fare: '', per_km_rate: '', base_km: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    const payload = {
      base_fare: form.base_fare ? Number(form.base_fare) : active?.base_fare ?? 45,
      per_km_rate: form.per_km_rate ? Number(form.per_km_rate) : active?.per_km_rate ?? 15,
      base_km: form.base_km ? Number(form.base_km) : active?.base_km ?? 2,
      is_active: true,
      name: `Updated ${new Date().toLocaleDateString('en-PH')}`,
    };
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('fare_config').insert(payload);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg('New fare version published. Checkout quotes use the active config.');
    setForm({ base_fare: '', per_km_rate: '', base_km: '' });
    reload();
  };

  return (
    <Card title="Fare engine" subtitle="Publishing creates a new version — history is preserved">
      <div className="kpi-grid">
        <Kpi tone="teal" icon="peso" label="Base fare" value={peso(active?.base_fare ?? 45)} hint={`first ${active?.base_km ?? 2} km`} />
        <Kpi tone="blue" icon="swap" label="Per km" value={peso(active?.per_km_rate ?? 15)} hint="beyond base" />
        <Kpi tone="violet" icon="box" label="Config" value={active?.name ?? 'Default'} hint={active ? formatDateTime(active.updated_at) : ''} />
      </div>
      <div className="form-row">
        <Field label="Base fare ₱" hint="Covers first base-km"><input className="input" type="number" min="0" value={form.base_fare} onChange={(e) => setForm({ ...form, base_fare: e.target.value })} placeholder={String(active?.base_fare ?? 45)} /></Field>
        <Field label="Base km"><input className="input" type="number" min="0" step="0.5" value={form.base_km} onChange={(e) => setForm({ ...form, base_km: e.target.value })} placeholder={String(active?.base_km ?? 2)} /></Field>
        <Field label="Per-km ₱"><input className="input" type="number" min="0" value={form.per_km_rate} onChange={(e) => setForm({ ...form, per_km_rate: e.target.value })} placeholder={String(active?.per_km_rate ?? 15)} /></Field>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'Publishing…' : 'Publish fare'}</button>
      </div>
      {msg ? <p className="notice">{msg}</p> : null}
    </Card>
  );
}
