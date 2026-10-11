import { useEffect, useState } from "react";
import Icon from "../icons";
import TimeSeries, { CountBars } from "./TimeSeries";
import { auditLabel, auditTone } from "./auditLabels";
import { api } from "../../api";
import { timeAgo } from "../../dateUtils";

function Kpi({ label, value, sub }) {
  return (
    <div className="tile">
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

  if (error) return <div className="alert error" role="alert"><Icon name="alert" />{error}</div>;
  if (!d) return <div className="stack"><div className="tiles">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skel" style={{ height: 110 }} />)}</div><div className="skel" style={{ height: 300 }} /></div>;

  const t = d.totals;
  const dates = d.series.map((s) => s.date);
  const rankRows = d.rank_distribution.map((r) => ({ label: `${r.rank}-rank`, count: r.count }));
  const funnelRows = d.funnel.map((f) => ({ label: f.step, count: f.count }));

  return (
    <div className="stack">
      <div className="tiles five">
        <Kpi label="Members" value={t.users} sub={`${t.admins} admin${t.admins === 1 ? "" : "s"}, ${t.disabled} disabled`} />
        <Kpi label="Active in 7 days" value={t.active_7d} sub={`${t.active_1d} in the last day`} />
        <Kpi label="New this week" value={t.new_7d} sub={`${t.onboarded} have set up a plan`} />
        <Kpi label="Avg completion, 7 days" value={`${t.avg_completion_7d}%`} sub={`avg streak ${t.avg_streak}`} />
        <Kpi label="Tasks completed" value={t.quests_cleared} sub="all time, all members" />
      </div>

      <div className="two-col">
        <section className="panel">
          <div className="panel-head"><h3 className="panel-title">People, last 30 days</h3></div>
          <TimeSeries dates={dates} label="Active members and new sign-ups per day for the last 30 days"
            series={[
              { key: "a", label: "Active members", color: "var(--cat-1)", values: d.series.map((s) => s.active_hunters) },
              { key: "s", label: "New sign-ups", color: "var(--cat-2)", values: d.series.map((s) => s.signups) },
            ]} />
        </section>
        <section className="panel">
          <div className="panel-head"><h3 className="panel-title">Tasks completed per day</h3></div>
          <TimeSeries dates={dates} label="Tasks completed per day for the last 30 days"
            series={[{ key: "q", label: "Tasks completed", color: "var(--cat-3)", values: d.series.map((s) => s.quests_cleared) }]} />
        </section>
      </div>

      <div className="two-col">
        <section className="panel">
          <div className="panel-head"><h3 className="panel-title">Where members drop off</h3><span className="panel-sub">Share of everyone who registered</span></div>
          <CountBars rows={funnelRows} total={t.users} />
        </section>
        <section className="panel">
          <div className="panel-head"><h3 className="panel-title">Rank distribution</h3><span className="panel-sub">Members with a plan in progress</span></div>
          <CountBars rows={rankRows} />
        </section>
      </div>

      <div className="two-col">
        <section className="panel">
          <div className="panel-head"><h3 className="panel-title">Recent activity</h3><a href="#/admin/audit" className="small">Full audit log</a></div>
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
        <section className="panel flat privacy">
          <div className="panel-head"><h3 className="panel-title">What this console can't show</h3></div>
          <p className="muted">Admins see account facts and progress numbers so they can spot who needs help and what the product teaches. Journal entries, quest names and passwords are never returned by any admin screen or API route.</p>
          <p className="muted" style={{ marginTop: 8 }}>Every admin action, including opening a member's profile, is written to the audit log.</p>
        </section>
      </div>
    </div>
  );
}
