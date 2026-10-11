import { useState } from "react";
import { formatShort, parseKey } from "../../dateUtils";

/* Multi-series line chart over a date axis (max 3 series). Hover/tap/arrow-key readout and a table view. */
export default function TimeSeries({ dates, series, label }) {
  const [idx, setIdx] = useState(null);
  const [table, setTable] = useState(false);
  const W = 640, H = 200, PL = 34, PR = 12, PT = 12, PB = 24;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const n = dates.length;
  const rawMax = Math.max(...series.flatMap((s) => s.values), 1);
  const step = rawMax <= 5 ? 1 : rawMax <= 20 ? 5 : rawMax <= 100 ? 20 : 50;
  const niceMax = Math.max(step, Math.ceil(rawMax / step) * step);
  const xFor = (i) => (n === 1 ? PL + plotW / 2 : PL + (plotW * i) / (n - 1));
  const yFor = (v) => PT + plotH - (v / niceMax) * plotH;
  const ticks = [0, niceMax / 2, niceMax].map((t) => Math.round(t * 10) / 10);
  const labelEvery = Math.ceil(n / 6);
  const shown = idx === null ? n - 1 : idx;

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    setIdx(Math.max(0, Math.min(n - 1, Math.round(((px - PL) / plotW) * (n - 1)))));
  };

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={yFor(t)} y2={yFor(t)} className={t === 0 ? "viz-axis" : "viz-grid"} />
            <text x={PL - 6} y={yFor(t) + 3} textAnchor="end" className="viz-axis-text">{t}</text>
          </g>
        ))}
        {dates.map((d, i) => (i % labelEvery === 0 ? (
          <text key={d} x={xFor(i)} y={H - 7} textAnchor="middle" className="viz-axis-text">{formatShort(parseKey(d))}</text>
        ) : null))}
        {series.map((s) => (
          <g key={s.key}>
            <polyline fill="none" stroke={s.color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round"
              points={s.values.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ")} />
            <circle cx={xFor(n - 1)} cy={yFor(s.values[n - 1])} r="4.5" fill={s.color} className="viz-ring" />
          </g>
        ))}
        {idx !== null && (
          <g pointerEvents="none">
            <line x1={xFor(idx)} x2={xFor(idx)} y1={PT} y2={PT + plotH} className="viz-cross" />
            {series.map((s) => <circle key={s.key} cx={xFor(idx)} cy={yFor(s.values[idx])} r="4.5" fill={s.color} className="viz-ring" />)}
          </g>
        )}
        <rect x={PL} y={PT} width={plotW} height={plotH} fill="transparent" tabIndex={0}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setIdx(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setIdx(Math.min(n - 1, (idx === null ? n - 1 : idx) + 1));
            if (e.key === "ArrowLeft") setIdx(Math.max(0, (idx === null ? n - 1 : idx) - 1));
          }}
          aria-label="Move across the chart to read each day" />
      </svg>
      <div className="viz-readout" aria-live="polite">
        <strong>{formatShort(parseKey(dates[shown]))}</strong>
        <span className="viz-readout-row">
          {series.map((s) => <span className="viz-key" key={s.key}><i className="sw" style={{ background: s.color }} />{s.label} {s.values[shown]}</span>)}
        </span>
      </div>
      <div className="viz-legend">
        {series.map((s) => <span className="viz-key" key={s.key}><i className="sw" style={{ background: s.color }} />{s.label}</span>)}
        <button type="button" className="link-btn" onClick={() => setTable(!table)}>{table ? "Hide table" : "View as table"}</button>
      </div>
      {table && (
        <div className="table-wrap">
          <table className="viz-table">
            <thead><tr><th>Day</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
            <tbody>{dates.map((d, i) => <tr key={d}><td>{formatShort(parseKey(d))}</td>{series.map((s) => <td key={s.key}>{s.values[i]}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CountBars({ rows, total }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar-row count" key={r.label}>
          <div className="hbar-label">{r.label}</div>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(r.count / max) * 100}%`, background: r.color || "var(--series-1)" }} /></div>
          <div className="hbar-value">{r.count}{total ? <span className="faint"> {Math.round((r.count / total) * 100)}%</span> : null}</div>
        </div>
      ))}
    </div>
  );
}
