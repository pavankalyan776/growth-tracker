import { useEffect, useState } from "react";
import Icon from "./icons";
import { ShadowArmy } from "./HunterPanel";
import { api } from "../api";
import { useGame } from "../game";
import { useLook } from "../look";

export default function AchievementsView() {
  const { overview: o } = useGame();
  const { w } = useLook();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.getMilestones().then(setItems).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="alert error" role="alert"><Icon name="alert" />{error}</div>;
  if (!items) return <div className="badge-grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skel" style={{ height: 130 }} />)}</div>;

  const earned = items.filter((m) => m.achieved);
  const coins = earned.reduce((s, m) => s + m.reward, 0);
  return (
    <div className="stack">
      <section className="panel tone wallet">
        <div>
          <div className="muted small">{w.milestones}</div>
          <div className="num wallet-num">{earned.length}<small>/{items.length}</small></div>
        </div>
        <p className="muted wallet-note">You have earned <b className="gold-text">{coins} coins</b> from milestones so far. Each one pays out once, the moment you reach it.</p>
      </section>
      {o && <section className="panel sm"><ShadowArmy count={o.perfect_days} /></section>}
      <ul className="badge-grid">
        {items.map((m) => (
          <li key={m.id} className={`badge${m.achieved ? " is-earned" : ""}`}>
            <div className="badge-icon"><Icon name={m.achieved ? "trophy" : "lock"} className="lg" /></div>
            <b className="display">{w.style === "calm" && m.calm ? m.calm.title : m.title}</b>
            <p className="small muted">{w.style === "calm" && m.calm ? m.calm.desc : m.desc}</p>
            <span className={`chip ${m.achieved ? "gold" : ""}`}><Icon name="coin" />{m.achieved ? "Earned" : `+${m.reward}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
