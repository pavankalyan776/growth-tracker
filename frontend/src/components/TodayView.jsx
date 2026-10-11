import { useCallback, useEffect, useMemo, useState } from "react";
import Gate from "./Gate";
import HunterPanel from "./HunterPanel";
import Icon from "./icons";
import { STAT_COLOR, STAT_NAME } from "./charts";
import { api } from "../api";
import { useGame } from "../game";
import { addDays, formatLong, getToday, inBlock, nowMinutes, parseBlock, parseKey, sameDay, toKey } from "../dateUtils";

const MOODS = [["1", "Rough"], ["2", "Low"], ["3", "Okay"], ["4", "Good"], ["5", "Great"]];

function systemMessage({ day, isToday, o, nextTask, isFuture, count, total }) {
  if (!day.in_plan) return "This day is outside your plan window. Change the window in Profile if you want to track it.";
  if (total === 0) return "No quests are set for this day. Add some in Quests.";
  if (isFuture) return "This gate hasn't opened yet. It unlocks at midnight.";
  if (count >= total) return isToday ? "Gate cleared. XP banked. Rest well, hunter." : "This gate was cleared. Well fought.";
  if (isToday && o.streak_at_risk) return `Clear every quest today to keep your ${o.current_streak}-day streak.`;
  if (count === 0) return isToday ? `The gate is open. ${total} quests stand between you and a clean day.` : "This gate was left open.";
  return nextTask && isToday
    ? `${count} down, ${total - count} to go. Next up: ${nextTask.label}.`
    : `${count} down, ${total - count} to go.`;
}

export default function TodayView({ dateKey, route }) {
  const { overview: o, refresh, announce, celebrate, toast } = useGame();
  const today = useMemo(getToday, []);
  const selected = dateKey ? parseKey(dateKey) : today;
  const key = toKey(selected);
  const isToday = sameDay(selected, today);
  const isFuture = selected > today;

  const [day, setDay] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState({});
  const [now, setNow] = useState(() => nowMinutes());

  useEffect(() => {
    const id = window.setInterval(() => setNow(nowMinutes()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try {
      setDay(await api.getDay(key));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [key]);

  useEffect(() => { setDay(null); load(); }, [load]);

  const tasks = useMemo(() => (day ? day.tasks.map((t) => ({ ...t, block: parseBlock(t.time_label) })) : []), [day]);
  const count = tasks.filter((t) => t.completed).length;
  const total = tasks.length;

  // "Now" = the block we're inside; "next" = first unfinished quest that hasn't ended yet.
  const nowTask = isToday ? tasks.find((t) => !t.completed && t.block && inBlock(t.block, now) && (t.block.end - t.block.start) < 600) : null;
  const nextTask = nowTask || tasks.find((t) => !t.completed && (!isToday || !t.block || t.block.start >= now || t.block.end - t.block.start >= 600)) || tasks.find((t) => !t.completed) || null;
  const activeIdx = nextTask && isToday ? tasks.indexOf(nextTask) : null;

  const toggle = async (task) => {
    if (pending[task.id] || isFuture || !day.in_plan) return;
    const want = !task.completed;
    const apply = (completed) => setDay((d) => ({
      ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, completed } : t)),
    }));
    apply(want);
    setPending((p) => ({ ...p, [task.id]: true }));
    try {
      const res = await api.toggleCompletion(task.id, key, want);
      announce(res.events);
      if (res.day_cleared && want) {
        const lines = [`+${res.xp_delta} XP`];
        const coins = (res.events || []).reduce((s, e) => s + e.amount, 0);
        if (coins > 0) lines.push(`+${coins} coins`);
        if (res.rank_up) lines.push(`Rank ${res.rank}`);
        else if (res.level_up) lines.push(`Level ${res.level}`);
        celebrate({ kind: res.rank_up ? "rank" : "gate", kicker: res.rank_up ? "The System acknowledges you" : isToday ? "Daily dungeon" : formatLong(selected), title: res.rank_up ? `Rank ${res.rank}` : "Gate cleared", lines });
      } else if ((res.rank_up || res.level_up) && want) {
        toast({ kind: "level", icon: "bolt", title: res.rank_up ? `Rank up: ${res.rank}` : `Level ${res.level}`, body: "Keep going." });
      }
      await refresh();
      if (!want || res.day_cleared) load();
    } catch (err) {
      apply(!want);
      toast({ icon: "alert", title: "That didn't save", body: err.message });
    } finally {
      setPending((p) => { const n = { ...p }; delete n[task.id]; return n; });
    }
  };

  const shield = async () => {
    try {
      const res = await api.useShield(key);
      announce(res.events);
      toast({ icon: "shield", title: "Streak shielded", body: `${formatLong(selected)} now counts toward your streak.` });
      await refresh();
      load();
    } catch (err) {
      toast({ icon: "alert", title: "Couldn't shield", body: err.message });
    }
  };

  const go = (delta) => route.navigate(`today/${toKey(addDays(selected, delta))}`);
  const message = day && o ? systemMessage({ day, isToday, o, nextTask, isFuture, count, total }) : "";
  const dayXp = count * 10 + (total > 0 && count === total ? 20 : 0);

  if (!o) return <TodaySkeleton />;

  return (
    <div className="today-grid">
      <div className="stack today-main">
        {isToday && o.penalty && (
          <section className="panel danger breach" role="alert" aria-label="Breach">
            <div className="breach-body">
              <Icon name="alert" className="lg" />
              <div className="grow">
                <h2 className="display">Breach: yesterday's gate was left open</h2>
                <p>You cleared {o.penalty.pct}% on {formatLong(parseKey(o.penalty.date))}. Your streak was reset to zero.</p>
              </div>
              {o.coins >= o.shield_cost ? (
                <button type="button" className="btn gold" onClick={async () => {
                  try {
                    const res = await api.useShield(o.penalty.date);
                    announce(res.events);
                    toast({ icon: "shield", title: "Streak shielded", body: "Yesterday now counts toward your streak." });
                    await refresh(); load();
                  } catch (err) { toast({ icon: "alert", title: "Couldn't shield", body: err.message }); }
                }}>Shield it, {o.shield_cost} coins</button>
              ) : (
                <span className="chip">Shield costs {o.shield_cost} coins, you have {o.coins}</span>
              )}
            </div>
          </section>
        )}

        <section className="panel tone gate-hero" aria-label="Daily gate">
          <div className="gate-hero-top">
            <div>
              <h2 className="display day-title">{formatLong(selected)}</h2>
              <p className="muted">{isToday ? "Today's gate" : isFuture ? "Upcoming gate" : "Past gate"}</p>
            </div>
            <div className="row">
              {!isToday && <button type="button" className="btn ghost sm" onClick={() => route.navigate("today")}>Back to today</button>}
              <button type="button" className="icon-btn" onClick={() => go(-1)} aria-label="Previous day"><Icon name="chevronLeft" /></button>
              <button type="button" className="icon-btn" onClick={() => go(1)} aria-label="Next day"><Icon name="chevronRight" /></button>
            </div>
          </div>

          {!day && !error ? <div className="skel" style={{ height: 300, marginTop: 16 }} /> : null}
          {error ? <div className="alert error" role="alert"><Icon name="alert" />{error} <button type="button" className="link-btn" onClick={load}>Retry</button></div> : null}

          {day && (
            <div className="gate-hero-body">
              <Gate count={count} total={total} size={300} active={activeIdx} />
              <div className="gate-info">
                <p className="system-message" aria-live="polite"><span className="chip cyan"><Icon name="sparkle" />System</span>{message}</p>
                <div className="row wrap">
                  {day.in_plan && total > 0 && !isFuture && <span className="chip accent"><Icon name="bolt" />+{dayXp} XP {isToday ? "today" : "that day"}</span>}
                  {day.in_plan && o.plan.day > 0 && isToday && <span className="chip">Day {Math.min(o.plan.day, o.plan.days)} of {o.plan.days}</span>}
                  {isToday && o.streak_at_risk && <span className="chip red"><Icon name="flame" />Streak at risk</span>}
                  {day.shielded && <span className="chip gold"><Icon name="shield" />Shielded</span>}
                </div>
                {nextTask && isToday && !isFuture && (
                  <div className="next-up">
                    <span className="label">{nowTask ? "Now" : "Next up"}</span>
                    <b>{nextTask.label}</b>
                    <span className="muted small"><Icon name="clock" className="sm" /> {nextTask.time_label}</span>
                  </div>
                )}
                {day.can_shield && (
                  <div className="shield-offer">
                    <p className="small">This day broke your streak. A shield repairs the streak but gives no XP.</p>
                    <button type="button" className="btn gold sm" onClick={shield} disabled={o.coins < o.shield_cost}>
                      <Icon name="shield" className="sm" />Shield this day, {o.shield_cost} coins
                    </button>
                    {o.coins < o.shield_cost && <span className="help">You have {o.coins}.</span>}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="panel timeline-panel" aria-label="Quests">
          <div className="panel-head"><h3 className="panel-title">Quests</h3>
            {day && total > 0 ? <span className="panel-sub">{count} of {total} cleared</span> : null}</div>
          {!day ? (
            <div className="stack">{[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 64 }} />)}</div>
          ) : total === 0 ? (
            <div className="empty"><div className="display">Nothing scheduled</div>Add quests for this day type in <a href="#/quests">Quests</a>.</div>
          ) : (
            <ol className="timeline">
              {tasks.map((t, i) => {
                const state = t.completed ? "done" : nowTask && t.id === nowTask.id ? "now" : "";
                return (
                  <li key={t.id} className={`q ${state}`}>
                    <span className="q-time num">{t.time_label}</span>
                    <span className="q-line" aria-hidden="true"><i /></span>
                    <button type="button" role="checkbox" aria-checked={t.completed} className="q-card"
                      onClick={() => toggle(t)} disabled={isFuture || !day.in_plan} aria-describedby={`q-meta-${t.id}`}>
                      <span className="q-box"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
                      <span className="q-main">
                        <span className="q-label">{t.label}</span>
                        <span className="q-meta" id={`q-meta-${t.id}`}>
                          <span className="stat-tag" style={{ "--c": STAT_COLOR[t.stat] }}><i />{STAT_NAME[t.stat]}</span>
                          {state === "now" && <span className="chip cyan">Now</span>}
                        </span>
                      </span>
                      <span className="q-xp num">+10</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {day && day.in_plan && !isFuture && <JournalCard key={key} dateKey={key} initial={day.journal} onSaved={(res) => { announce(res.events); refresh(); load(); }} />}
      </div>

      <aside className="today-side"><HunterPanel o={o} /></aside>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="today-grid">
      <div className="stack"><div className="skel" style={{ height: 420 }} /><div className="skel" style={{ height: 360 }} /></div>
      <div className="stack"><div className="skel" style={{ height: 300 }} /><div className="skel" style={{ height: 300 }} /></div>
    </div>
  );
}

function JournalCard({ dateKey, initial, onSaved }) {
  const { toast } = useGame();
  const [mood, setMood] = useState(initial ? initial.mood : null);
  const [note, setNote] = useState(initial ? initial.note : "");
  const [struggle, setStruggle] = useState(initial ? initial.struggle : "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(!!initial);
  const dirty = (v, set) => (e) => { set(e.target.value); setSaved(false); };

  const save = async () => {
    setBusy(true);
    try {
      const res = await api.saveJournal(dateKey, { mood, note, struggle });
      setSaved(true);
      onSaved(res);
    } catch (err) {
      toast({ icon: "alert", title: "Couldn't save your log", body: err.message });
    } finally { setBusy(false); }
  };
  const remove = async () => {
    try {
      await api.deleteJournal(dateKey);
      setMood(null); setNote(""); setStruggle(""); setSaved(false);
      onSaved({ events: [] });
    } catch (err) { toast({ icon: "alert", title: "Couldn't delete", body: err.message }); }
  };

  return (
    <section className="panel journal" aria-label="Daily log">
      <div className="panel-head">
        <h3 className="panel-title">Daily log</h3>
        <span className="panel-sub"><Icon name="lock" className="sm" /> Private. Only you can read this.</span>
      </div>
      <div className="field">
        <span className="label" id="mood-label">How did today feel?</span>
        <div className="seg" role="radiogroup" aria-labelledby="mood-label">
          {MOODS.map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={mood === Number(v)} aria-pressed={mood === Number(v)}
              onClick={() => { setMood(Number(v)); setSaved(false); }}>{label}</button>
          ))}
        </div>
      </div>
      <div className="field"><label htmlFor={`note-${dateKey}`}>What happened?</label>
        <textarea id={`note-${dateKey}`} className="textarea" value={note} onChange={dirty(note, setNote)} maxLength={2000} placeholder="Wins, surprises, anything worth remembering." /></div>
      <div className="field"><label htmlFor={`hard-${dateKey}`}>What was hard?</label>
        <textarea id={`hard-${dateKey}`} className="textarea" value={struggle} onChange={dirty(struggle, setStruggle)} maxLength={2000} placeholder="Pain is data. Write it down so you can beat it." /></div>
      <div className="row">
        <button type="button" className="btn" onClick={save} disabled={busy || (!mood && !note.trim() && !struggle.trim())}>{busy ? "Saving…" : "Save log"}</button>
        {saved && initial !== undefined ? <span className="chip cyan"><Icon name="check" />Saved</span> : null}
        <span className="spacer" />
        {(initial || saved) && <button type="button" className="link-btn small" onClick={remove}>Delete entry</button>}
      </div>
    </section>
  );
}
