import { useId } from "react";

/* The Gate: one arc per quest. Each cleared quest lights its arc; clearing them all closes the gate. */
function arcPath(cx, cy, r, a0, a1) {
  const rad = (a) => ((a - 90) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(rad(a0)), y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1)), y1 = cy + r * Math.sin(rad(a1));
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export default function Gate({ count, total, label = "quests cleared", size = 320, closedText = "Gate cleared", active = null }) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const cleared = total > 0 && count >= total;
  const R = 138, C = 160;
  const n = Math.max(total, 1);
  const gap = total > 1 ? 6 : 0;
  const span = 360 / n;
  const segs = Array.from({ length: n }, (_, i) => ({
    d: arcPath(C, C, R, i * span + gap / 2, (i + 1) * span - gap / 2 - (total === 1 ? 0.01 : 0)),
    on: i < count,
  }));

  return (
    <div className={`gate${cleared ? " is-cleared" : ""}`} style={{ width: size, height: size }}
      role="img" aria-label={`${count} of ${total} ${label}`}>
      <svg viewBox="0 0 320 320" aria-hidden="true">
        <defs>
          <linearGradient id={`${gid}-g`} gradientUnits="userSpaceOnUse" x1="30" y1="30" x2="290" y2="290">
            <stop offset="0" style={{ stopColor: "var(--accent)" }} />
            <stop offset="1" style={{ stopColor: "var(--accent-text)" }} />
          </linearGradient>
          <radialGradient id={`${gid}-r`} cx="50%" cy="50%" r="50%">
            <stop offset="0" style={{ stopColor: "var(--accent)", stopOpacity: cleared ? 0.42 : 0.16 }} />
            <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r="150" fill={`url(#${gid}-r)`} className="gate-aura" />
        <circle cx={C} cy={C} r="116" className="gate-ticks" />
        <circle cx={C} cy={C} r="104" className="gate-inner" />
        {total === 0 ? (
          <circle cx={C} cy={C} r={R} className="gate-seg gate-empty" />
        ) : segs.map((s, i) => (
          <path key={i} d={s.d} className={`gate-seg${s.on ? " on" : ""}`}
            style={{ stroke: s.on ? `url(#${gid}-g)` : undefined, transitionDelay: s.on ? `${Math.min(i, 8) * 30}ms` : "0ms" }} />
        ))}
        {active !== null && active < total && !cleared ? (
          <path d={segs[active].d} className="gate-now" />
        ) : null}
      </svg>
      <div className="gate-center">
        {total === 0 ? (
          <>
            <span className="num gate-big">0</span>
            <span className="gate-caption">no quests today</span>
          </>
        ) : cleared ? (
          <>
            <span className="num gate-big gate-done">{count}<small>/{total}</small></span>
            <span className="gate-caption gate-closed">{closedText}</span>
          </>
        ) : (
          <>
            <span className="num gate-big">{count}<small>/{total}</small></span>
            <span className="gate-caption">{label}</span>
          </>
        )}
      </div>
    </div>
  );
}
