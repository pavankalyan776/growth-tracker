const STAT_KEYS = ["STR", "INT", "PER", "VIT", "AGI"];
const STAT_LABELS = { STR: "Strength", INT: "Intellect", PER: "Perception", VIT: "Vitality", AGI: "Agility" };

export default function RadarChart({ totals }) {
  const max = Math.max(...STAT_KEYS.map((k) => totals[k] || 0), 1);
  const cx = 100, cy = 95, R = 70;
  const angleFor = (i) => ((-90 + i * 72) * Math.PI) / 180;
  const pt = (i, ratio) => {
    const a = angleFor(i);
    return [cx + R * ratio * Math.cos(a), cy + R * ratio * Math.sin(a)];
  };

  const rings = [0.25, 0.5, 0.75, 1].map((ring, ri) => {
    const pts = STAT_KEYS.map((_, i) => pt(i, ring).join(",")).join(" ");
    return <polygon key={ri} points={pts} fill="none" stroke="var(--border)" strokeWidth="1" />;
  });

  const axes = STAT_KEYS.map((_, i) => {
    const [x, y] = pt(i, 1);
    return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />;
  });

  const dataPts = STAT_KEYS.map((k, i) => pt(i, (totals[k] || 0) / max).join(",")).join(" ");

  const labels = STAT_KEYS.map((k, i) => {
    const [x, y] = pt(i, 1.28);
    return (
      <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
        fontFamily="var(--font-hud)" fontSize="12" fontWeight="700" fill="var(--text-muted)">
        {k}
      </text>
    );
  });

  return (
    <div>
      <svg viewBox="0 0 200 190" style={{ width: "100%", maxWidth: 280, display: "block", margin: "0 auto" }}>
        {rings}
        {axes}
        <polygon points={dataPts} fill="var(--accent-glow)" stroke="var(--accent)" strokeWidth="2" />
        {labels}
      </svg>
      <div className="stat-legend">
        {STAT_KEYS.map((k) => (
          <span key={k}><b>{totals[k] || 0}</b> {STAT_LABELS[k]}</span>
        ))}
      </div>
    </div>
  );
}
