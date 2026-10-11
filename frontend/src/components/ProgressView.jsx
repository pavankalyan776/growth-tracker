import { useEffect, useState } from "react";
import Icon from "./icons";
import { HBars, Heatmap, StatLines, STAT_COLOR, WeeklyBars } from "./charts";
import { useLook, useStatNames } from "../look";
import { api } from "../api";
import { formatShort, parseKey } from "../dateUtils";

const MOODS = ["Rough", "Low", "Okay", "Good", "Great"];

function Tile({ label, value, sub, tone }) {
  return (
    <div className={`tile ${tone || ""}`}>
      <div className="small muted">{label}</div>
      <div className="num big-num">{value}</div>
      {sub ? <div className="small faint">{sub}</div> : null}
    </div>
  );
}

function Card({ title, hint, children, wide }) {
  return (
    <section className={`panel${wide ? " wide" : ""}`}>
      <div className="panel-head"><h3 className="panel-title">{title}</h3></div>
      {hint ? <p className="panel-sub" style={{ marginTop: -8, marginBottom: 12 }}>{hint}</p> : null}
      {children}
    </section>
  );
}

export default function ProgressView({ route }) {
  const { w } = useLook();
  const { name: STAT_NAME } = useStatNames();
  const [data, setData] = useState(null);
  const [heat, setHeat] = useState(null);
  const [journal, setJournal] = useState([]);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const open = (d) => route.navigate(`today/${d}`);

  useEffect(() => {
    Promise.all([api.getAnalytics(), api.getHeatmap(), api.getJournalList(10)])
      .then(([a, h, j]) => { setData(a); setHeat(h); setJournal(j); })
      .catch((e) => setError(e.message));
  }, []);

  const download = async () => {
    setExporting(true);
    try {
      const all = await api.exportAll();
      const url = URL.createObjectURL(new Blob([JSON.stringify(all, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = `growth-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
    setExporting(false);
  };

  if (error && !data) return <div className="alert error" role="alert"><Icon name="alert" />{error}</div>;
  if (!data) return <div className="progress-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 160 }} />)}</div>;

  const s = data.summary;
  const statRows = data.per_stat.map((p) => ({ key: p.stat, label: STAT_NAME[p.stat], value: p.rate, color: STAT_COLOR[p.stat], hint: `${p.done} of ${p.possible} possible` }));
  const monthRows = data.months.map((m) => ({ key: m.key, label: m.label, value: m.avg, hint: `${m.days} days tracked` }));
  const weekdayRows = data.weekday.map((w) => ({ key: w.label, label: w.label, value: w.avg, hint: `${w.days} days` }));
  const questRow = (q) => ({ key: q.id, label: `${q.label} (${q.day_type})`, value: q.rate, hint: `${q.done} of ${q.possible}` });

  return (
    <div className="stack">
      <div className="tiles">
        <Tile label="Average completion" value={`${s.avg_completion}%`} sub={`${s.tracked_days} days tracked`} />
        <Tile label="Perfect days" value={s.perfect_days} sub={`every ${w.habit} done`} />
        <Tile label="Current streak" value={s.current_streak} sub={`best ${s.longest_streak}`} />
        <Tile label="Missed days" value={s.missed_days} sub="see the ledger below" tone={s.missed_days ? "warn" : ""} />
      </div>

      <Card title="Consistency map" hint={`Every day of your plan. Darker means more ${w.habitsLower} done.`} wide>
        <Heatmap cells={heat} onPick={open} />
      </Card>

      <div className="progress-grid">
        <Card title="Weekly completion"><WeeklyBars weeks={data.weeks} /></Card>
        <Card title="Monthly average" hint="The tick marks the 80% line for the monthly coin bonus.">
          {monthRows.length ? <HBars rows={monthRows} target={80} /> : <div className="viz-empty">No full data yet.</div>}
        </Card>
        <Card title={w.style === "calm" ? "Consistency by strength" : "Consistency by stat"}><HBars rows={statRows} /></Card>
        <Card title="Day-of-week pattern" hint="Find the days that quietly sink you."><HBars rows={weekdayRows} /></Card>
        {data.weakest.length > 0 && (
          <Card title="Needs attention" hint={`Your least-completed ${w.habitsLower} so far.`}>
            <HBars rows={data.weakest.map(questRow)} />
            {data.strongest.length > 0 && (<><h4 className="subhead">Going strong</h4><HBars rows={data.strongest.map(questRow)} /></>)}
          </Card>
        )}
        <Card title={w.style === "calm" ? "Strength growth" : "Stat growth"} hint={`Cumulative ${w.style === "calm" ? "points" : "XP"} in each area, week by week.`}><StatLines growth={data.stat_growth} /></Card>
      </div>

      <div className="progress-grid">
        <Card title="Setbacks ledger" hint="Days that didn't count. Every one is a lesson, and a streak shield can repair any of them.">
          {data.missed.length === 0 ? <div className="viz-empty">No missed days. Keep it that way.</div> : (
            <ul className="ledger">
              {data.missed.map((m) => (
                <li key={m.date}>
                  <div className="ledger-main">
                    <strong>{formatShort(parseKey(m.date))}</strong>
                    <span className="ledger-pct">{m.pct}% done</span>
                    <button type="button" className="link-btn" onClick={() => open(m.date)}>Open</button>
                  </div>
                  {m.struggle && <div className="ledger-note struggle">"{m.struggle}"</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Growth log" hint="Your private daily entries.">
          {journal.length === 0 ? <div className="viz-empty">Write your first daily log on the Today page.</div> : (
            <ul className="ledger">
              {journal.map((j) => (
                <li key={j.date}>
                  <div className="ledger-main">
                    <strong>{formatShort(parseKey(j.date))}</strong>
                    {j.mood ? <span className="chip">{MOODS[j.mood - 1]}</span> : null}
                    <span className="spacer" />
                    <button type="button" className="link-btn" onClick={() => open(j.date)}>Open</button>
                  </div>
                  {j.note && <div className="ledger-note">{j.note}</div>}
                  {j.struggle && <div className="ledger-note struggle">Hard: {j.struggle}</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section className="panel sm row wrap">
        <div className="grow"><b>Back up your data</b><p className="small muted">{`${w.habits}, history, journal and coins as one JSON file.`}</p></div>
        <button type="button" className="btn ghost" onClick={download} disabled={exporting}><Icon name="download" />{exporting ? "Preparing…" : "Download backup"}</button>
      </section>
    </div>
  );
}
