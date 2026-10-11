import { useState } from "react";
import { formatLong, formatShort, parseKey } from "../dateUtils";

/* Chart rules used here (see the dataviz notes in extra.css):
   - one hue ramp for magnitude (heatmap), fixed-order categorical hues for the 5 stats
   - thin marks, 4px rounded data-end, 2px gaps, hairline recessive grid
   - every chart has a hover/tap/focus readout, and a table view where colour could be ambiguous
   - text never wears a series colour: the colour lives on the mark / swatch beside it */

export const STAT_COLOR = {
  STR: "var(--cat-1)", INT: "var(--cat-2)", PER: "var(--cat-3)", VIT: "var(--cat-4)", AGI: "var(--cat-5)",
};
export const STAT_NAME = {
  STR: "Strength", INT: "Intellect", PER: "Perception", VIT: "Vitality", AGI: "Agility",
};
const STATS = ["STR", "INT", "PER", "VIT", "AGI"];

function bucket(pct) {
  if (pct === null || pct === undefined) return "future";
  if (pct === 0) return "0";
  if (pct >= 100) return "4";
  if (pct >= 70) return "3";
  if (pct >= 40) return "2";
  return "1";
}

/* ------------------------------------------------------------------ */
/* Heatmap: one cell per day of the plan (HabitKit / GitHub style)     */
/* ------------------------------------------------------------------ */
export function Heatmap({ cells, onPick }) {
  const [active, setActive] = useState(null);
  if (!cells || cells.length === 0) return null;

  const CELL = 14, GAP = 3, STEP = CELL + GAP, LEFT = 16, TOP = 14;
  const first = parseKey(cells[0].date);
  const offset = (first.getDay() + 6) % 7; // Monday = row 0
  const cols = Math.ceil((cells.length + offset) / 7);
  const width = LEFT + cols * STEP;
  const height = TOP + 7 * STEP;

  const monthLabels = [];
  let lastMonth = -1;
  cells.forEach((c, i) => {
    const d = parseKey(c.date);
    if (d.getMonth() !== lastMonth) {
      lastMonth = d.getMonth();
      monthLabels.push({ x: LEFT + Math.floor((i + offset) / 7) * STEP, text: formatShort(d).slice(0, 3) });
    }
  });

  const describe = (c) => {
    const label = formatLong(parseKey(c.date));
    if (c.pct === null) return `${label}, upcoming`;
    if (c.shielded) return `${label}, missed, streak shielded`;
    if (c.pct === 0) return `${label}, missed (0%)`;
    return `${label}, ${c.pct}% of quests`;
  };

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="hm" role="img"
        aria-label="Daily completion heatmap for the whole plan">
        {["M", "W", "F"].map((t, i) => (
          <text key={t} x="0" y={TOP + i * 2 * STEP + CELL - 3} className="viz-axis-text">{t}</text>
        ))}
        {monthLabels.map((m) => (
          <text key={m.text + m.x} x={m.x} y="9" className="viz-axis-text">{m.text}</text>
        ))}
        {cells.map((c, i) => {
          const col = Math.floor((i + offset) / 7);
          const row = (i + offset) % 7;
          const x = LEFT + col * STEP;
          const y = TOP + row * STEP;
          return (
            <g key={c.date}>
              <rect x={x} y={y} width={CELL} height={CELL} rx="3"
                className={`hm-cell hm-${bucket(c.pct)}${active === c.date ? " is-active" : ""}`}
                tabIndex={0} role="button" aria-label={describe(c)}
                onMouseEnter={() => setActive(c.date)} onFocus={() => setActive(c.date)}
                onClick={() => { setActive(c.date); if (onPick && c.pct !== null) onPick(c.date); }}
                onKeyDown={(e) => { if (e.key === "Enter" && onPick && c.pct !== null) onPick(c.date); }}>
                <title>{describe(c)}</title>
              </rect>
              {c.shielded && (
                <path d={`M${x + 7} ${y + 3} L${x + 11} ${y + 7} L${x + 7} ${y + 11} L${x + 3} ${y + 7} Z`}
                  className="hm-shield" pointerEvents="none" />
              )}
            </g>
          );
        })}
      </svg>
      <div className="viz-readout" aria-live="polite">
        {active ? describe(cells.find((c) => c.date === active)) : "Hover or tap a day. Tap again to open it."}
      </div>
      <div className="viz-legend">
        <span className="viz-key"><i className="sw hm-sw-0" />missed</span>
        <span className="viz-key"><i className="sw hm-sw-1" />some</span>
        <span className="viz-key"><i className="sw hm-sw-2" />half</span>
        <span className="viz-key"><i className="sw hm-sw-3" />most</span>
        <span className="viz-key"><i className="sw hm-sw-4" />perfect</span>
        <span className="viz-key"><i className="sw-diamond" />shielded</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Weekly completion columns (single series: no legend, title names it) */
/* ------------------------------------------------------------------ */
function topRoundedBar(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, h, w / 2));
  return `M${x} ${y + h} L${x} ${y + rr} Q${x} ${y} ${x + rr} ${y} L${x + w - rr} ${y} Q${x + w} ${y} ${x + w} ${y + rr} L${x + w} ${y + h} Z`;
}

export function WeeklyBars({ weeks }) {
  const [active, setActive] = useState(null);
  if (!weeks || weeks.length === 0) return <div className="viz-empty">Complete a few days and your weeks will appear here.</div>;

  const W = 320, H = 130, PL = 26, PR = 6, PT = 8, PB = 20;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const slot = plotW / weeks.length;
  const barW = Math.min(24, Math.max(4, slot - 6));
  const yFor = (v) => PT + plotH - (v / 100) * plotH;
  const labelEvery = Math.ceil(weeks.length / 6);
  const describe = (w) => `Week of ${formatShort(parseKey(w.start))}, ${w.avg}% average, ${w.perfect} perfect day${w.perfect === 1 ? "" : "s"}`;
  const last = weeks.length - 1;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img" aria-label="Average completion per week">
        {[0, 50, 100].map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={yFor(t)} y2={yFor(t)} className={t === 0 ? "viz-axis" : "viz-grid"} />
            <text x={PL - 5} y={yFor(t) + 3} textAnchor="end" className="viz-axis-text">{t}</text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const cx = PL + slot * i + slot / 2;
          const h = (w.avg / 100) * plotH;
          return (
            <g key={w.start}>
              {h > 0 && (
                <path d={topRoundedBar(cx - barW / 2, yFor(w.avg), barW, h, 4)}
                  className={`viz-bar${active !== null && active !== i ? " is-dim" : ""}`} />
              )}
              {i === last && <text x={cx} y={yFor(w.avg) - 4} textAnchor="middle" className="viz-value-text">{w.avg}%</text>}
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 6} textAnchor="middle" className="viz-axis-text">{formatShort(parseKey(w.start))}</text>
              )}
              <rect x={PL + slot * i} y={PT} width={slot} height={plotH + PB} fill="transparent" tabIndex={0}
                role="button" aria-label={describe(w)}
                onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)}
                onMouseLeave={() => setActive(null)} />
            </g>
          );
        })}
      </svg>
      <div className="viz-readout" aria-live="polite">
        {active !== null ? describe(weeks[active]) : "Hover or tap a week. The current week is still in progress."}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat growth: cumulative XP per stat over time (5 categorical lines)  */
/* ------------------------------------------------------------------ */
export function StatLines({ growth }) {
  const [idx, setIdx] = useState(null);
  const [table, setTable] = useState(false);
  if (!growth || growth.length === 0) return <div className="viz-empty">Your stat curves start after your first tracked day.</div>;

  const W = 320, H = 150, PL = 30, PR = 10, PT = 10, PB = 22;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const rawMax = Math.max(...growth.flatMap((g) => STATS.map((k) => g[k])), 1);
  const niceMax = Math.max(50, Math.ceil(rawMax / 50) * 50);
  const n = growth.length;
  const xFor = (i) => (n === 1 ? PL + plotW / 2 : PL + (plotW * i) / (n - 1));
  const yFor = (v) => PT + plotH - (v / niceMax) * plotH;
  const ticks = [0, niceMax / 2, niceMax];
  const labelEvery = Math.ceil(n / 5);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = n === 1 ? 0 : Math.round(((px - PL) / plotW) * (n - 1));
    setIdx(Math.max(0, Math.min(n - 1, i)));
  };

  const shown = idx === null ? n - 1 : idx;
  const g = growth[shown];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img"
        aria-label="Cumulative stat growth per week for strength, intellect, perception, vitality and agility">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={yFor(t)} y2={yFor(t)} className={t === 0 ? "viz-axis" : "viz-grid"} />
            <text x={PL - 5} y={yFor(t) + 3} textAnchor="end" className="viz-axis-text">{t}</text>
          </g>
        ))}
        {growth.map((p, i) => (i % labelEvery === 0 ? (
          <text key={p.start} x={xFor(i)} y={H - 7} textAnchor="middle" className="viz-axis-text">{formatShort(parseKey(p.start))}</text>
        ) : null))}

        {STATS.map((k) => (
          <g key={k}>
            {n > 1 && (
              <polyline fill="none" stroke={STAT_COLOR[k]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                points={growth.map((p, i) => `${xFor(i)},${yFor(p[k])}`).join(" ")} />
            )}
            {/* end marker: >= 8px, 2px surface ring */}
            <circle cx={xFor(n - 1)} cy={yFor(growth[n - 1][k])} r="4" fill={STAT_COLOR[k]} className="viz-ring" />
          </g>
        ))}

        {idx !== null && (
          <g pointerEvents="none">
            <line x1={xFor(idx)} x2={xFor(idx)} y1={PT} y2={PT + plotH} className="viz-cross" />
            {STATS.map((k) => (
              <circle key={k} cx={xFor(idx)} cy={yFor(g[k])} r="4" fill={STAT_COLOR[k]} className="viz-ring" />
            ))}
          </g>
        )}
        <rect x={PL} y={PT} width={plotW} height={plotH} fill="transparent" tabIndex={0}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setIdx(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setIdx(Math.min(n - 1, (idx === null ? n - 1 : idx) + 1));
            if (e.key === "ArrowLeft") setIdx(Math.max(0, (idx === null ? n - 1 : idx) - 1));
          }}
          aria-label="Move across the chart to read each week" />
      </svg>

      <div className="viz-readout" aria-live="polite">
        <strong>Week of {formatShort(parseKey(g.start))}</strong>
        <span className="viz-readout-row">
          {STATS.map((k) => (
            <span className="viz-key" key={k}><i className="sw" style={{ background: STAT_COLOR[k] }} />{k} {g[k]}</span>
          ))}
        </span>
      </div>

      <div className="viz-legend">
        {STATS.map((k) => (
          <span className="viz-key" key={k}><i className="sw" style={{ background: STAT_COLOR[k] }} />{STAT_NAME[k]}</span>
        ))}
        <button type="button" className="link-btn" onClick={() => setTable(!table)}>
          {table ? "Hide table" : "View as table"}
        </button>
      </div>

      {table && (
        <div className="table-wrap">
          <table className="viz-table">
            <thead><tr><th>Week of</th>{STATS.map((k) => <th key={k}>{k}</th>)}</tr></thead>
            <tbody>
              {growth.map((p) => (
                <tr key={p.start}><td>{formatShort(parseKey(p.start))}</td>{STATS.map((k) => <td key={k}>{p[k]}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Horizontal bars: label, thin bar, value. Optional target tick.       */
/* ------------------------------------------------------------------ */
export function HBars({ rows, target }) {
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar-row" key={r.key || r.label} title={r.hint || ""}>
          <div className="hbar-label">{r.label}</div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${Math.max(0, Math.min(100, r.value))}%`, background: r.color || "var(--series-1)" }} />
            {target !== undefined && <div className="hbar-target" style={{ left: `${target}%` }} />}
          </div>
          <div className="hbar-value">{r.value}%</div>
        </div>
      ))}
    </div>
  );
}
