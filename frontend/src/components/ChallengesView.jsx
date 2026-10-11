import { useCallback, useEffect, useState } from "react";
import { BossCard, ChallengeBuilder, ChallengeCard, DareCard } from "./Challenges";
import { Empty, ErrorNote, Skeletons } from "./ui";
import { api } from "../api";
import { useGame } from "../game";
import { useLook } from "../look";
import { getToday, toKey } from "../dateUtils";

/* Challenges hub: today's dare, this week's boss, and the challenges you built yourself. */
export default function ChallengesView() {
  const { overview: o, refresh } = useGame();
  const { w } = useLook();
  const todayKey = toKey(getToday());
  const [data, setData] = useState(null);
  const [dare, setDare] = useState(null);
  const [error, setError] = useState("");
  const [building, setBuilding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getChallenges(), api.getDay(todayKey)])
      .then(([c, d]) => { if (alive) { setData(c); setDare(d.in_plan ? d.dare : null); } })
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [todayKey]);

  const onChange = useCallback((updated, deletedId) => {
    setData((d) => {
      if (!d) return d;
      if (deletedId) return { ...d, items: d.items.filter((x) => x.id !== deletedId) };
      return { ...d, items: d.items.map((x) => (x.id === updated.id ? updated : x)) };
    });
    if (deletedId) refresh();
  }, [refresh]);

  const created = (ch) => { setData((d) => ({ ...d, items: [ch, ...d.items] })); setBuilding(false); };

  if (error && !data) return <ErrorNote error={error} />;
  if (!data || !o) return <Skeletons n={3} h={170} />;

  const live = data.items.filter((c) => c.status === "active" || c.status === "upcoming");
  const finished = data.items.filter((c) => c.status === "done" || c.status === "missed");
  const archived = data.items.filter((c) => c.status === "archived");
  const full = live.length >= data.max_active;

  return (
    <div className="stack">
      <h2 className="section-title display">🎲 Today <small>Optional, and it never touches your streak</small></h2>
      <div className="cc-grid">
        {dare ? <DareCard key={dare.date || todayKey} dare={dare} dateKey={todayKey} isToday /> : (
          <section className="card cc"><Empty emoji="📅" title="No dare today">Dares appear on days inside your plan window.</Empty></section>
        )}
        {o.boss ? <BossCard boss={o.boss} /> : (
          <section className="card cc"><Empty emoji="⚔️" title={`No ${w.boss.toLowerCase()} this week`}>Add some {w.habitsLower} to get one.</Empty></section>
        )}
      </div>

      <div className="row wrap" style={{ marginTop: 8 }}>
        <h2 className="section-title display grow" style={{ margin: 0 }}>🎯 My challenges <small>{live.length} of {data.max_active} live</small></h2>
        <button type="button" className="btn" onClick={() => setBuilding(true)} disabled={full} title={full ? "Finish or delete one first" : undefined}>➕ Build a challenge</button>
      </div>
      <p className="muted small">Pick something small, say how many check-ins and how many days. Finish it for 🪙 +{data.reward.coins} and ✨ +{data.reward.xp} XP (up to {data.reward.weekly_cap} rewarded a week).</p>

      {live.length === 0 && finished.length === 0 ? (
        <section className="card">
          <Empty emoji="🚀" title="Make your first challenge">
            <p style={{ marginBottom: 14 }}>"Walk 20 minutes" for 10 days. "Read 10 pages" 20 times. You choose.</p>
            <button type="button" className="btn" onClick={() => setBuilding(true)}>➕ Build a challenge</button>
          </Empty>
        </section>
      ) : (
        <div className="cc-grid">
          {live.map((c) => <ChallengeCard key={c.id} c={c} todayKey={todayKey} onChange={onChange} reward />)}
        </div>
      )}

      {finished.length > 0 && (
        <>
          <h2 className="section-title display">🏁 Finished <small>{finished.length}</small></h2>
          <div className="cc-grid">{finished.map((c) => <ChallengeCard key={c.id} c={c} todayKey={todayKey} onChange={onChange} />)}</div>
        </>
      )}

      {archived.length > 0 && (
        <>
          <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
          {showArchived && <div className="cc-grid">{archived.map((c) => <ChallengeCard key={c.id} c={c} todayKey={todayKey} onChange={onChange} />)}</div>}
        </>
      )}

      {building && <ChallengeBuilder onClose={() => setBuilding(false)} onCreated={created} planEnd={o.plan.end} />}
    </div>
  );
}
