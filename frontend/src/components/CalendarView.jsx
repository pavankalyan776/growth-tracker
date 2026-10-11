import { useEffect, useState } from "react";
import Icon from "./icons";
import { api } from "../api";
import { useGame } from "../game";
import { DOWS_SHORT, MONTHS, formatFull, getToday, parseKey, sameDay } from "../dateUtils";

function cellState(d) {
  if (!d.in_plan) return "outside";
  if (d.is_future) return "future";
  if (d.shielded) return "shielded";
  if (d.pct === 0) return "miss";
  if (d.pct >= 100) return "perfect";
  return "part";
}

export default function CalendarView({ route }) {
  const { overview: o } = useGame();
  const today = getToday();
  const planStart = o && o.plan.start ? parseKey(o.plan.start) : today;
  const planEnd = o && o.plan.end ? parseKey(o.plan.end) : today;
  const initial = today < planStart ? planStart : today > planEnd ? planEnd : today;
  const [ym, setYm] = useState({ y: initial.getFullYear(), m: initial.getMonth() });
  const [cal, setCal] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setCal(null);
    api.getCalendar(`${ym.y}-${String(ym.m + 1).padStart(2, "0")}`)
      .then((c) => { setCal(c); setError(""); })
      .catch((e) => setError(e.message));
  }, [ym]);

  const step = (delta) => setYm(({ y, m }) => {
    const n = m + delta;
    return n < 0 ? { y: y - 1, m: 11 } : n > 11 ? { y: y + 1, m: 0 } : { y, m: n };
  });
  const prevDisabled = ym.y * 12 + ym.m <= planStart.getFullYear() * 12 + planStart.getMonth();
  const nextDisabled = ym.y * 12 + ym.m >= planEnd.getFullYear() * 12 + planEnd.getMonth();

  const lead = cal ? (parseKey(cal.days[0].date).getDay() + 6) % 7 : 0;

  return (
    <div className="cal-layout">
      <section className="panel" aria-label="Calendar">
        <div className="panel-head">
          <h2 className="panel-title">{MONTHS[ym.m]} {ym.y}</h2>
          <div className="row">
            <button type="button" className="icon-btn" disabled={prevDisabled} onClick={() => step(-1)} aria-label="Previous month"><Icon name="chevronLeft" /></button>
            <button type="button" className="icon-btn" disabled={nextDisabled} onClick={() => step(1)} aria-label="Next month"><Icon name="chevronRight" /></button>
          </div>
        </div>
        {error && <div className="alert error" role="alert"><Icon name="alert" />{error}</div>}
        {!cal && !error && <div className="skel" style={{ height: 420 }} />}
        {cal && (
          <div className="cal-grid" role="grid" aria-label={cal.label}>
            {DOWS_SHORT.map((d) => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
            {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} className="cal-cell empty" />)}
            {cal.days.map((d) => {
              const dt = parseKey(d.date);
              const st = cellState(d);
              return (
                <button key={d.date} type="button" disabled={!d.in_plan} role="gridcell"
                  className={`cal-cell ${st}${sameDay(dt, today) ? " is-today" : ""}`}
                  style={{ "--p": d.pct || 0 }}
                  aria-label={`${d.date}${d.pct !== undefined ? `, ${d.pct}% cleared` : ""}${d.shielded ? ", shielded" : ""}${d.has_journal ? ", has a log entry" : ""}`}
                  onClick={() => route.navigate(`today/${d.date}`)}>
                  <span className="ring"><b className="num">{dt.getDate()}</b></span>
                  {d.shielded && <Icon name="shield" className="sm cal-badge" />}
                  {d.has_journal && <i className="cal-dot" />}
                </button>
              );
            })}
          </div>
        )}
        <ul className="legend" aria-label="Legend">
          <li><i className="lg-ring perfect" />Perfect</li>
          <li><i className="lg-ring part" />Partly cleared</li>
          <li><i className="lg-ring miss" />Missed</li>
          <li><Icon name="shield" className="sm" />Shielded</li>
          <li><i className="cal-dot static" />Log entry</li>
        </ul>
      </section>

      <aside className="stack">
        <section className="panel sm">
          <div className="small muted">Month average</div>
          <div className="num big-num">{cal && cal.tracked ? `${cal.avg}%` : "None yet"}</div>
          <p className="small muted">Finish a month at 80% or better to earn the +100 coin monthly achievement. Tap any day to open it and fix what you missed.</p>
        </section>
        {o && (
          <section className="panel sm">
            <div className="small muted">Plan window</div>
            <div className="display" style={{ fontSize: "1.5rem" }}>{formatFull(parseKey(o.plan.start))} to {formatFull(parseKey(o.plan.end))}</div>
            <p className="small muted">Day {Math.min(o.plan.day, o.plan.days)} of {o.plan.days}. {o.plan.days_left} days left.</p>
          </section>
        )}
      </aside>
    </div>
  );
}
