import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { START, END, TODAY, MONTHS, DOWS_SHORT, sameDay, inRange, toKey } from "../dateUtils";

function cellClass(within, isFuture, shielded, pct, total) {
  if (!within) return "outside";
  if (isFuture) return "future";
  if (shielded) return "shielded";
  if (total === 0) return "outside";
  if (pct === 0) return "miss";
  if (pct === 100) return "perfect";
  if (pct >= 70) return "high";
  if (pct >= 40) return "mid";
  return "low";
}

function DayModal({ date, onClose, onChanged }) {
  const [dayData, setDayData] = useState(null);
  const [stats, setStats] = useState(null);

  const load = useCallback(() => {
    api.getDay(toKey(date)).then(setDayData);
    api.getStats().then(setStats);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (questId, completed) => {
    await api.toggleCompletion(questId, toKey(date), completed);
    load();
    onChanged();
  };

  const useShield = async () => {
    try {
      await api.useShield(toKey(date));
      load();
      onChanged();
    } catch (e) {
      alert(e.message.includes("Not enough") ? "Not enough coins for a shield." : "Could not apply shield.");
    }
  };

  if (!dayData) return null;
  const eligible = date <= TODAY && dayData.score.pct < 100 && !dayData.shielded;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-head">
          <h2>{MONTHS[date.getMonth()].slice(0, 3)} {date.getDate()}, {date.getFullYear()}</h2>
          <button className="close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <ul className="tasklist">
          {dayData.tasks.map((t) => (
            <li key={t.id} className={t.completed ? "checked" : ""}>
              <input type="checkbox" id={`m_${t.id}`} checked={t.completed} onChange={(e) => toggle(t.id, e.target.checked)} />
              <div className="time">{t.time_label}</div>
              <label htmlFor={`m_${t.id}`}>{t.label}<span className="statchip">{t.stat}</span></label>
            </li>
          ))}
        </ul>
        {(date <= TODAY && dayData.score.pct < 100) && (
          <button
            className="shield-btn"
            disabled={!eligible || !stats || stats.coins < 30}
            onClick={useShield}
          >
            {dayData.shielded ? "Shield already active" : "Use Streak Shield — 30 🪙"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CalendarView({ onDataChanged }) {
  const [calMonth, setCalMonth] = useState(TODAY.getMonth());
  const [calYear, setCalYear] = useState(TODAY.getFullYear());
  const [dayScores, setDayScores] = useState({});
  const [shields, setShields] = useState(new Set());
  const [openDate, setOpenDate] = useState(null);

  const loadMonth = useCallback(() => {
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const dates = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(calYear, calMonth, d);
      if (inRange(dt) && dt <= TODAY) dates.push(dt);
    }
    Promise.all(dates.map((d) => api.getDay(toKey(d)))).then((results) => {
      const map = {};
      results.forEach((r, i) => { map[toKey(dates[i])] = r.score; });
      setDayScores(map);
    });
    api.getShields().then((list) => setShields(new Set(list)));
  }, [calMonth, calYear]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  const firstOfMonth = new Date(calYear, calMonth, 1);
  const firstDow = firstOfMonth.getDay();
  const lead = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const cells = [];
  for (let b = 0; b < lead; b++) cells.push(<div key={"e" + b} className="cal-cell empty" />);
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(calYear, calMonth, day);
    const within = inRange(d);
    const isFuture = d > TODAY;
    const key = toKey(d);
    const score = dayScores[key];
    const shielded = shields.has(key);
    const cls = cellClass(within, isFuture, shielded, score ? score.pct : 0, score ? score.total : 0);
    cells.push(
      <div
        key={key}
        className={`cal-cell ${cls}${sameDay(d, TODAY) ? " is-today" : ""}`}
        onClick={() => within && setOpenDate(d)}
      >
        {day}
      </div>
    );
  }

  const prevDisabled = calYear === START.getFullYear() && calMonth <= START.getMonth();
  const nextDisabled = calYear === END.getFullYear() && calMonth >= END.getMonth();

  return (
    <section>
      <div className="panel-head">
        <h2>{MONTHS[calMonth]} {calYear}</h2>
        <div className="navbtns">
          <button disabled={prevDisabled} onClick={() => { let m = calMonth - 1, y = calYear; if (m < 0) { m = 11; y--; } setCalMonth(m); setCalYear(y); }}>‹</button>
          <button disabled={nextDisabled} onClick={() => { let m = calMonth + 1, y = calYear; if (m > 11) { m = 0; y++; } setCalMonth(m); setCalYear(y); }}>›</button>
        </div>
      </div>
      <div className="cal-grid">
        {DOWS_SHORT.map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {cells}
      </div>
      <div className="legend">
        <span><i style={{ background: "var(--danger-tint)" }} />missed</span>
        <span><i style={{ background: "var(--accent)" }} />strong</span>
        <span><i style={{ background: "var(--success)" }} />perfect</span>
        <span><i style={{ background: "var(--gold-tint)" }} />shielded</span>
      </div>

      {openDate && (
        <DayModal
          date={openDate}
          onClose={() => { setOpenDate(null); loadMonth(); }}
          onChanged={() => { loadMonth(); onDataChanged(); }}
        />
      )}
    </section>
  );
}
