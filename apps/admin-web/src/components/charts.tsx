import type { DayBucket } from '../lib/analytics';

/** Area + bar trend for GMV / orders over the last 14 days. */
export function TrendChart({ data, mode }: { data: DayBucket[]; mode: 'gmv' | 'orders' }) {
  const values = data.map((d) => (mode === 'gmv' ? d.gmv : d.orders));
  const max = Math.max(1, ...values);
  const W = 560;
  const H = 180;
  const PAD = 10;
  const step = (W - PAD * 2) / Math.max(1, data.length - 1);
  const pts = values.map((v, i) => ({
    x: PAD + i * step,
    y: H - PAD - (v / max) * (H - PAD * 2 - 18),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - PAD} L${pts[0].x.toFixed(1)},${H - PAD} Z`;
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="14-day trend">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#008080" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#008080" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} className="grid" />
        ))}
        <path d={area} fill="url(#trendFill)" />
        <path d={line} fill="none" stroke="#008080" strokeWidth="2.5" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={values[i] > 0 ? 3.5 : 2} className="dot" />
            <title>{`${data[i].label}: ${mode === 'gmv' ? `₱${values[i].toFixed(0)}` : values[i]}`}</title>
          </g>
        ))}
      </svg>
      <div className="chart-x">
        {data.filter((_, i) => i % 2 === 0).map((d) => (
          <span key={d.key}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export function Hbars({ items, format }: {
  items: { key: string; label: string; value: number }[];
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const fmt = format ?? ((v: number) => String(v));
  return (
    <div className="hbars">
      {items.map((i) => (
        <div key={i.key} className="hbar-row">
          <span className="hbar-label">{i.label}</span>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          <span className="hbar-value">{fmt(i.value)}</span>
        </div>
      ))}
      {items.length === 0 ? <p className="muted">No data yet.</p> : null}
    </div>
  );
}

export function Donut({ items }: { items: { key: string; label: string; value: number; color: string }[] }) {
  const total = items.reduce((a, i) => a + i.value, 0);
  if (!total) return <p className="muted">No data yet.</p>;
  const R = 54;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="Status mix">
        <circle cx="70" cy="70" r={R} className="donut-bg" />
        {items.map((i) => {
          const frac = i.value / total;
          const dash = `${frac * C} ${C - frac * C}`;
          const rot = (acc / total) * 360;
          acc += i.value;
          return (
            <circle
              key={i.key}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={i.color}
              strokeWidth="16"
              strokeDasharray={dash}
              transform={`rotate(${-90 + rot} 70 70)`}
              strokeLinecap="butt"
            >
              <title>{`${i.label}: ${i.value}`}</title>
            </circle>
          );
        })}
        <text x="70" y="66" textAnchor="middle" className="donut-num">{total}</text>
        <text x="70" y="84" textAnchor="middle" className="donut-cap">orders</text>
      </svg>
      <ul className="legend">
        {items.map((i) => (
          <li key={i.key}>
            <span className="swatch" style={{ background: i.color }} />
            <span>{i.label}</span>
            <strong>{i.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="spark" aria-hidden>
      {values.map((v, i) => (
        <span key={i} style={{ height: `${18 + (v / max) * 82}%` }} className={v > 0 ? 'on' : ''} />
      ))}
    </div>
  );
}
