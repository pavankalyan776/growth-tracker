import { useEffect, useState } from "react";
import TimeSeries, { CountBars } from "./TimeSeries";
import { auditLabel, auditTone } from "./auditLabels";
import { ErrorNote } from "../ui";
import { api } from "../../api";
import { timeAgo } from "../../dateUtils";

function Kpi({ emoji, label, value, sub }) {
  return (
    <div className="tile">
      <span className="tile-emoji emoji" aria-hidden="true">{emoji}</span>
      <div className="small muted">{label}</div>
      <div className="num big-num">{value}</div>
      {sub ? <div className="small faint">{sub}</div> : null}
    </div>
  );
}

export default function AdminDashboard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.adminOverview().then(setD).catch((e) => setError(e.message)); }, []);

  if (error) return <ErrorNote error={error} />;
  if (!d) return <div className="stack"><div className="tiles five">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skel" style={{ height: 120 }} />)}</div><div className="skel" style={{ height: 300 }} /></div>;

  const t = d.totals;
  const dates = d.series.map((s) => s.date);
  const rankRows = d.rank_distribution.map((r) => ({ label: `Rank ${r.rank}`, count: r.count }));
  const funnelRows = d.funnel.map((f) => ({ label: f.step, count: f.count }));

  return (
    <div className="stack">
      <div className="tiles five">
        <Kpi emoji="👥" label="Members" value={t.users} sub={t.disabled ? `${t.disabled} disabled` : "everyone who signed up"} />
        <Kpi emoji="⚡" label="Active in 7 days" value={t.active_7d} sub={`${t.active_1d} in the last day`} />
        <Kpi emoji="🆕" label="New this week" value={t.new_7d} sub={`${t.onboarded} have set up a plan`} />
        <Kpi emoji="🎯" label="Avg completion, 7 days" value={`${t.avg_completion_7d}%`} sub={`avg streak ${t.avg_streak}`} />
        <Kpi emoji="✅" label="Tasks completed" value={t.tasks_done} sub="all time, all members" />
      </div>
      <div className="tiles">
        <Kpi emoji="🎲" label="Dares finished" value={t.dares_done} sub="all time" />
        <Kpi emoji="🏗️" label="Challenges built" value={t.challenges_built} sub="by members, no code" />
        <Kpi emoji="📅" label="Active in 30 days" value={t.active_30d} sub={`of ${t.active_accounts} active accounts`} />
        <a className="tile" href="#/admin/studio" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="tile-emoji emoji" aria-hidden="true">🎛️</span>
          <div className="small muted">Content studio</div>
          <div className="display" style={{ fontSize: "1.2rem" }}>Edit what members see</div>
          <div className="small faint">Dares, plans, announcements</div>
        </a>
      </div>

      <div className="two-col">
        <section className="card">
          <div className="card-head"><h3 className="card-title">👥 Members, last 30 days</h3></div>
          <TimeSeries dates={dates} label="Active members and new sign-ups per day for the last 30 days"
            series={[
              { key: "a", label: "Active members", color: "var(--cat-1)", values: d.series.map((s) => s.active_members) },
              { key: "s", label: "New sign-ups", color: "var(--cat-2)", values: d.series.map((s) => s.signups) },
            ]} />
        </section>
        <section className="card">
          <div className="card-head"><h3 className="card-title">✅ Tasks completed per day</h3></div>
          <TimeSeries dates={dates} label="Tasks completed per day for the last 30 days"
            series={[{ key: "q", label: "Tasks completed", color: "var(--cat-3)", values: d.series.map((s) => s.tasks_done) }]} />
        </section>
      </div>

      <div className="two-col">
        <section className="card">
          <div className="card-head"><h3 className="card-title">🚪 Where members drop off</h3><span className="card-sub">Share of everyone who registered</span></div>
          <CountBars rows={funnelRows} total={t.users} />
        </section>
        <section className="card">
          <div className="card-head"><h3 className="card-title">🏅 Level spread</h3><span className="card-sub">Members with a plan in progress</span></div>
          <CountBars rows={rankRows} />
        </section>
      </div>

      <div className="two-col">
        <section className="card">
          <div className="card-head"><h3 className="card-title">🕒 Recent activity</h3><a href="#/admin/audit" className="card-sub">Full audit log</a></div>
          <ul className="feed">
            {d.recent_audit.map((a) => (
              <li key={a.id}>
                <span className={`chip ${auditTone(a.action)}`}>{auditLabel(a.action)}</span>
                <span className="grow small">{a.target_email || a.actor_email || "system"}</span>
                <span className="small faint">{timeAgo(a.at)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card tint">
          <div className="card-head"><h3 className="card-title">🔒 What this console can't show</h3></div>
          <p className="muted">Admins see account facts and progress numbers so they can spot who needs help and what the product teaches. Journal entries, task names, which dares someone did, and passwords are never returned by any admin screen or API route.</p>
          <p className="muted" style={{ marginTop: 8 }}>Every admin action, including opening a member's profile and every edit in the Content studio, is written to the audit log.</p>
        </section>
      </div>
    </div>
  );
}
