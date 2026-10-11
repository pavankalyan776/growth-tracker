import { STAT_COLOR } from "./charts";
import { STAT_EMOJI, useStatNames } from "../look";

const KEYS = ["STR", "INT", "PER", "VIT", "AGI"];

/* Stat radar. Five axes, an emoji on each; the values are also listed as text below. */
export default function Radar({ totals }) {
  const { name } = useStatNames();
  const max = Math.max(...KEYS.map((k) => totals[k] || 0), 1);
  const cx = 110, cy = 104, R = 68;
  const ang = (i) => ((-90 + i * 72) * Math.PI) / 180;
  const pt = (i, ratio) => [cx + R * ratio * Math.cos(ang(i)), cy + R * ratio * Math.sin(ang(i))];
  const poly = (ratio) => KEYS.map((_, i) => pt(i, ratio).join(",")).join(" ");
  const data = KEYS.map((k, i) => pt(i, (totals[k] || 0) / max).join(",")).join(" ");

  return (
    <div>
      <svg viewBox="0 0 220 208" className="radar" role="img"
        aria-label={`Stats: ${KEYS.map((k) => `${name[k]} ${totals[k] || 0}`).join(", ")}`}>
        {[0.33, 0.66, 1].map((r) => <polygon key={r} points={poly(r)} className="radar-ring" />)}
        {KEYS.map((k, i) => { const [x, y] = pt(i, 1); return <line key={k} x1={cx} y1={cy} x2={x} y2={y} className="radar-axis" />; })}
        <polygon points={data} className="radar-shape" />
        {KEYS.map((k, i) => {
          const [x, y] = pt(i, (totals[k] || 0) / max);
          return <circle key={k} cx={x} cy={y} r="4.5" fill={STAT_COLOR[k]} className="viz-ring" />;
        })}
        {KEYS.map((k, i) => {
          const [x, y] = pt(i, 1.34);
          return <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="radar-label">{STAT_EMOJI[k]}</text>;
        })}
      </svg>
      <ul className="stat-list">
        {KEYS.map((k) => (
          <li key={k}><span className="emoji" aria-hidden="true">{STAT_EMOJI[k]}</span><span>{name[k]}</span><b className="num">{totals[k] || 0}</b></li>
        ))}
      </ul>
    </div>
  );
}
