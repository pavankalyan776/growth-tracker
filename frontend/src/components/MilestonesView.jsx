import { useState, useEffect } from "react";
import { api } from "../api";

export default function MilestonesView() {
  const [milestones, setMilestones] = useState(null);

  useEffect(() => { api.getMilestones().then(setMilestones); }, []);

  if (!milestones) return <div className="loading">Loading achievements…</div>;

  return (
    <section>
      <div className="panel-head"><h2>Achievements</h2></div>
      <div>
        {milestones.map((m) => (
          <div key={m.id} className={`milestone${m.achieved ? " done" : ""}`}>
            <div className="icon">{m.achieved ? "✓" : "○"}</div>
            <div className="info">
              <div className="t">{m.title}</div>
              <div className="d">{m.desc}</div>
            </div>
            <div className="reward">+{m.reward}🪙</div>
          </div>
        ))}
      </div>
    </section>
  );
}
