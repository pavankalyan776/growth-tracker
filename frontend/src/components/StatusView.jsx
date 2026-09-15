import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import RadarChart from "./RadarChart";
import {
  START, END, TODAY, MONTHS, addDays, clampDate, sameDay, inRange, mondayOf, toKey,
} from "../dateUtils";

export default function StatusView({ stats, onDataChanged }) {
  const [date, setDate] = useState(clampDate(TODAY, START, END));
  const [dayData, setDayData] = useState(null);
  const [weekStars, setWeekStars] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadDay = useCallback((d) => {
    setLoading(true);
    api.getDay(toKey(d)).then((res) => { setDayData(res); setLoading(false); });
  }, []);

  useEffect(() => { loadDay(date); }, [date, loadDay]);

  useEffect(() => {
    const start = mondayOf(date);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => inRange(d) && d <= TODAY);
    if (days.length === 0) { setWeekStars(0); return; }
    Promise.all(days.map((d) => api.getDay(toKey(d)))).then((results) => {
      const avg = results.reduce((a, r) => a + r.score.pct, 0) / results.length;
      setWeekStars(Math.max(0, Math.min(5, Math.round(avg / 20))));
    });
  }, [date]);

  const toggle = async (questId, completed) => {
    await api.toggleCompletion(questId, toKey(date), completed);
    loadDay(date);
    onDataChanged();
  };

  const idxInPlan = Math.round((date - START) / 86400000) + 1;
  const totalPlan = Math.round((END - START) / 86400000) + 1;
  let metaText = `Day ${idxInPlan} of ${totalPlan}`;
  metaText += sameDay(date, TODAY) ? " · today's quest" : date < TODAY ? " · past" : " · upcoming";

  return (
    <section>
      <div className="panel-head">
        <div className="navbtns">
          <button disabled={sameDay(date, START)} onClick={() => setDate(addDays(date, -1))}>‹</button>
        </div>
        <div className="day-strip" style={{ flex: 1 }}>
          <div className="dtxt">{MONTHS[date.getMonth()].slice(0, 3)} {date.getDate()}, {date.getFullYear()}</div>
          <div className="dsub">{metaText}</div>
        </div>
        <div className="navbtns">
          <button disabled={sameDay(date, END)} onClick={() => setDate(addDays(date, 1))}>›</button>
        </div>
      </div>

      {loading || !dayData ? (
        <div className="loading">Loading today's quests…</div>
      ) : (
        <ul className="tasklist">
          {dayData.tasks.map((t) => (
            <li key={t.id} className={t.completed ? "checked" : ""}>
              <input
                type="checkbox"
                id={`cb_${t.id}`}
                checked={t.completed}
                onChange={(e) => toggle(t.id, e.target.checked)}
              />
              <div className="time">{t.time_label}</div>
              <label htmlFor={`cb_${t.id}`}>
                {t.label}
                <span className="statchip">{t.stat}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="radar-wrap">
        <h3>Hunter stats</h3>
        {stats && <RadarChart totals={stats.stat_totals} />}
      </div>

      <div className="week-mini">
        <div>
          <div className="label">This week</div>
          <div className="stars">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={i < weekStars ? "" : "empty"}>★</span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="label">Total quests cleared</div>
          <div className="hud-num" style={{ fontSize: 20 }}>{stats ? stats.total_completed : 0}</div>
        </div>
      </div>
    </section>
  );
}
