import { useEffect, useState } from "react";
import { ErrorNote } from "./ui";
import { api } from "../api";
import { useGame } from "../game";
import { useLook } from "../look";

export default function AchievementsView() {
  const { overview: o } = useGame();
  const { w } = useLook();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.getMilestones().then(setItems).catch((e) => setError(e.message)); }, []);

  if (error) return <ErrorNote error={error} />;
  if (!items) return <div className="badge-grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skel" style={{ height: 150 }} />)}</div>;

  const earned = items.filter((m) => m.achieved);
  const coins = earned.reduce((s, m) => s + m.reward, 0);
  return (
    <div className="stack">
      <section className="card tint wallet">
        <div>
          <div className="muted small">🏅 {w.milestones}</div>
          <div className="num wallet-num">{earned.length}<small>/{items.length}</small></div>
        </div>
        <p className="muted wallet-note">You have earned <b className="gold-text">🪙 {coins} coins</b> from milestones so far. Each one pays out once, the moment you reach it.
          {o ? <> You also have <b>{o.perfect_days}</b> {o.perfect_days === 1 ? w.armyUnit : w.armyUnits} {w.armyEmoji}.</> : null}</p>
      </section>
      <ul className="badge-grid">
        {items.map((m) => (
          <li key={m.id} className={`badge${m.achieved ? " is-earned" : ""}`}>
            <span className="badge-emoji emoji" aria-hidden="true">{m.emoji || "🏆"}</span>
            <b className="display">{w.style === "calm" && m.calm ? m.calm.title : m.title}</b>
            <p className="small muted">{w.style === "calm" && m.calm ? m.calm.desc : m.desc}</p>
            <span className={`chip ${m.achieved ? "gold" : ""}`}>{m.achieved ? "✅ Earned" : `🔒 🪙 +${m.reward}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
