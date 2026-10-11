import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Avatar from "./Avatar";
import { BossCard, DareCard } from "./Challenges";
import Icon from "./icons";
import Radar from "./Radar";
import { Bar, Empty, RankBadge, Ring } from "./ui";
import { api } from "../api";
import { useGame } from "../game";
import { MOOD_LIST, STAT_EMOJI, useLook, useStatNames } from "../look";
import { addDays, formatLong, getToday, inBlock, nowMinutes, parseBlock, parseKey, sameDay, toKey } from "../dateUtils";

function systemMessage({ day, isToday, o, nextTask, isFuture, count, total, w }) {
  if (!day.in_plan) return "📅 This day is outside your plan window. Change the window in Profile if you want to track it.";
  if (total === 0) return `🗒️ No ${w.habitsLower} are set for this day. Add some in ${w.myHabits}.`;
  if (isFuture) return w.futureLine;
  if (count >= total) return w.doneLine(isToday);
  if (isToday && o.streak_at_risk) return `🔥 Finish every ${w.habit} today to keep your ${o.current_streak}-day streak.`;
  if (count === 0) return w.openLine(isToday, total);
  return nextTask && isToday
    ? `💪 ${count} down, ${total - count} to go. Next up: ${nextTask.label}.`
    : `💪 ${count} down, ${total - count} to go.`;
}

function greeting(hour) {
  return hour < 5 ? "🌙 Still up" : hour < 12 ? "☀️ Good morning" : hour < 17 ? "🌤️ Good afternoon" : hour < 22 ? "🌆 Good evening" : "🌙 Late night";
}

/* One task row. Memoised so ticking one task re-renders one row, not the whole list. */
const TaskRow = memo(function TaskRow({ task, now, disabled, onToggle, statName }) {
  return (
    <li>
      <button type="button" role="checkbox" aria-checked={task.completed} disabled={disabled}
        className={`task${task.completed ? " is-done" : ""}${now ? " is-now" : ""}`} onClick={() => onToggle(task)}>
        <span className="task-check"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
        <span className="task-main">
          <span className="task-label">{task.label}</span>
          <span className="task-meta">
            <span className="stat-tag"><span className="emoji" aria-hidden="true">{STAT_EMOJI[task.stat]}</span>{statName}</span>
            <span>🕒 {task.time_label}</span>
            {now && <span className="chip info">Now</span>}
          </span>
        </span>
        <span className="task-xp">+10 XP</span>
      </button>
    </li>
  );
});

export default function TodayView({ dateKey, route }) {
  const { overview: o, commit, celebrate, toast, refresh } = useGame();
  const { w } = useLook();
  const { name: STAT_NAME } = useStatNames();
  const today = useMemo(getToday, []);
  const selected = dateKey ? parseKey(dateKey) : today;
  const key = toKey(selected);
  const isToday = sameDay(selected, today);
  const isFuture = selected > today;

  const [day, setDay] = useState(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => nowMinutes());
  const seq = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(nowMinutes()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try { setDay(await api.getDay(key)); setError(""); } catch (err) { setError(err.message); }
  }, [key]);

  useEffect(() => {
    let alive = true;
    setDay(null);
    api.getDay(key).then((d) => { if (alive) { setDay(d); setError(""); } }).catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [key]);

  const tasks = useMemo(() => (day ? day.tasks.map((t) => ({ ...t, block: parseBlock(t.time_label) })) : []), [day]);
  const count = tasks.filter((t) => t.completed).length;
  const total = tasks.length;

  const nowTask = isToday ? tasks.find((t) => !t.completed && t.block && inBlock(t.block, now) && (t.block.end - t.block.start) < 600) : null;
  const nextTask = nowTask || tasks.find((t) => !t.completed && (!isToday || !t.block || t.block.start >= now || t.block.end - t.block.start >= 600)) || tasks.find((t) => !t.completed) || null;

  const canEdit = !!day && day.in_plan && !isFuture;

  /* Optimistic: the row flips instantly. The server's answer carries the new day AND overview, so there is no refetch.
     If you tap several quickly, only the newest answer is applied (it already includes the older taps). */
  const toggle = useCallback(async (task) => {
    if (!canEdit) return;
    const want = !task.completed;
    const mine = ++seq.current;
    const flip = (completed) => setDay((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, completed } : t)) }));
    flip(want);
    try {
      const res = await api.toggleCompletion(task.id, key, want);
      commit(res);
      if (mine === seq.current && res.day) setDay(res.day);
      if (res.day_cleared && want) {
        const lines = [`✨ +${res.xp_delta} XP`];
        const coins = (res.events || []).reduce((s, e) => s + e.amount, 0);
        if (coins > 0) lines.push(`🪙 +${coins} coins`);
        if (res.rank_up) lines.push(`🏅 ${w.rankNamed(res.rank)}`);
        else if (res.level_up) lines.push(`⬆️ Level ${res.level}`);
        celebrate({
          kind: res.rank_up ? "rank" : "gate", emoji: res.rank_up ? "👑" : "🎉",
          kicker: res.rank_up ? w.rankKicker : isToday ? w.welcomeKicker : formatLong(selected),
          title: res.rank_up ? w.rankNamed(res.rank) : w.dayCleared, lines,
        });
      } else if ((res.rank_up || res.level_up) && want) {
        toast({ emoji: "⬆️", title: res.rank_up ? `${w.rankUp}: ${w.rankLabel(res.rank)}` : `Level ${res.level}!`, body: "Keep going. 🚀" });
      }
    } catch (err) {
      flip(!want);
      toast({ kind: "bad", emoji: "⚠️", title: "That didn't save", body: err.message });
    }
  }, [canEdit, key, commit, celebrate, toast, w, isToday, selected]);

  const shield = async (dateStr) => {
    try {
      const res = await api.useShield(dateStr);
      commit(res);
      if (res.day && res.day.date === key) setDay(res.day);
      toast({ emoji: "🛡️", title: "Streak shielded", body: "That day now counts toward your streak." });
    } catch (err) {
      toast({ kind: "bad", emoji: "⚠️", title: "Couldn't shield", body: err.message });
    }
  };

  const go = (delta) => route.navigate(`today/${toKey(addDays(selected, delta))}`);
  const message = day && o ? systemMessage({ day, isToday, o, nextTask, isFuture, count, total, w }) : "";
  const dayXp = count * 10 + (total > 0 && count === total ? 20 : 0);

  if (!o) return <TodaySkeleton />;

  const showBoss = isToday && o.boss;
  const showDare = day && day.dare && !isFuture;
  const hour = new Date().getHours();

  return (
    <div className="today-grid">
      <div className="stack">
        {isToday && <Announcements items={o.announcements} />}

        {isToday && o.penalty && (
          <section className="card danger-card breach" role="alert" aria-label="Breach">
            <span className="breach-emoji emoji" aria-hidden="true">🚨</span>
            <div className="grow">
              <h2 className="display">{w.breach}</h2>
              <p className="muted">You cleared {o.penalty.pct}% on {formatLong(parseKey(o.penalty.date))}. Your streak was reset to zero.</p>
            </div>
            {o.coins >= o.shield_cost
              ? <button type="button" className="btn gold" onClick={() => shield(o.penalty.date)}>🛡️ Shield it · {o.shield_cost} coins</button>
              : <span className="chip">Shield costs {o.shield_cost} coins, you have {o.coins}</span>}
          </section>
        )}

        <section className="hero" aria-label={w.dayLabel}>
          <div className="hero-top">
            <span className="hero-date">{isToday ? w.dayName : isFuture ? w.dayFuture : w.dayPast}</span>
            <span className="spacer" />
            {!isToday && <button type="button" className="btn ghost sm" onClick={() => route.navigate("today")}>Back to today</button>}
            <button type="button" className="icon-btn" onClick={() => go(-1)} aria-label="Previous day"><Icon name="chevronLeft" /></button>
            <button type="button" className="icon-btn" onClick={() => go(1)} aria-label="Next day"><Icon name="chevronRight" /></button>
          </div>
          <div className="hero-body">
            <div className="hero-copy">
              <h2 className="hero-title display">{isToday ? `${greeting(hour)}, ${o.hunter_name}!` : formatLong(selected)}</h2>
              {error ? <div className="alert error" role="alert"><Icon name="alert" />{error} <button type="button" className="link-btn" onClick={load}>Retry</button></div> : null}
              {!day && !error ? <div className="skel" style={{ height: 56, opacity: .35 }} /> : (
                <p className="hero-msg" aria-live="polite">{message}</p>
              )}
              {day && (
                <div className="hero-chips">
                  {day.in_plan && total > 0 && !isFuture && <span className="chip">✨ +{dayXp} XP {isToday ? "today" : "that day"}</span>}
                  {day.in_plan && o.plan.day > 0 && isToday && <span className="chip">🗓️ Day {Math.min(o.plan.day, o.plan.days)} of {o.plan.days}</span>}
                  {isToday && o.streak_at_risk && <span className="chip">🔥 Streak at risk</span>}
                  {day.shielded && <span className="chip">🛡️ Shielded</span>}
                </div>
              )}
              {day && nextTask && isToday && !isFuture && (
                <div className="next-up"><small>{nowTask ? "⏰ Now" : "👉 Next up"}</small><b>{nextTask.label}</b></div>
              )}
              {day && day.can_shield && (
                <div className="shield-offer">
                  <span className="small">This day broke your streak. A shield repairs the streak but gives no XP.</span>
                  <button type="button" className="btn gold sm" onClick={() => shield(key)} disabled={o.coins < o.shield_cost}>🛡️ Shield this day · {o.shield_cost} coins</button>
                  {o.coins < o.shield_cost && <span className="small">You have {o.coins}.</span>}
                </div>
              )}
            </div>
            {day ? <Ring count={count} total={total} size={176} stroke={15} cap={w.habitsDone} closedCap={w.dayCleared}
              ariaLabel={`${count} of ${total} ${w.habitsDone}`} /> : <div className="skel" style={{ width: 176, height: 176, borderRadius: "50%", opacity: .35 }} />}
          </div>
        </section>

        {(showDare || showBoss) && (
          <div className="cc-grid">
            {showBoss && <BossCard boss={o.boss} />}
            {showDare && <DareCard key={day.date} dare={day.dare} dateKey={day.date} isToday={isToday}
              onResult={(res) => { if (res.day) setDay(res.day); }} />}
          </div>
        )}

        <section className="card" aria-label={w.habits}>
          <div className="card-head"><h3 className="card-title">📝 {w.habits}</h3>
            {day && total > 0 ? <span className="card-sub">{count} of {total} {w.cleared}</span> : null}</div>
          {!day ? (
            <div className="stack">{[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 64 }} />)}</div>
          ) : total === 0 ? (
            <Empty emoji="🗒️" title="Nothing scheduled">Add {w.habitsLower} for this day type in <a href="#/quests">{w.myHabits}</a>.</Empty>
          ) : (
            <ol className="tasks">
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} now={!!nowTask && nowTask.id === t.id} disabled={!canEdit}
                  onToggle={toggle} statName={STAT_NAME[t.stat]} />
              ))}
            </ol>
          )}
        </section>

        {day && day.in_plan && !isFuture && (
          <JournalCard key={key} dateKey={key} initial={day.journal} onSaved={(res) => {
            if (res.events && res.events.length) { commit(res); refresh(); }
          }} />
        )}
      </div>

      <aside className="today-side"><SidePanel o={o} todayKey={toKey(today)} /></aside>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="today-grid">
      <div className="stack"><div className="skel" style={{ height: 260 }} /><div className="skel" style={{ height: 300 }} /></div>
      <div className="stack"><div className="skel" style={{ height: 260 }} /><div className="skel" style={{ height: 220 }} /></div>
    </div>
  );
}

function Announcements({ items }) {
  const [hidden, setHidden] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("gt-hidden-ann") || "[]"); } catch { return []; }
  });
  const shown = (items || []).filter((a) => !hidden.includes(a.id)).slice(0, 2);
  if (shown.length === 0) return null;
  const hide = (id) => {
    const next = [...hidden, id];
    setHidden(next);
    try { sessionStorage.setItem("gt-hidden-ann", JSON.stringify(next)); } catch { /* ignore */ }
  };
  return shown.map((a) => (
    <aside key={a.id} className={`banner tone-${a.tone}`} aria-label="Announcement">
      <span className="banner-emoji emoji" aria-hidden="true">{a.emoji}</span>
      <div className="grow"><b>{a.title}</b>{a.body ? <p>{a.body}</p> : null}</div>
      <button type="button" className="icon-btn" onClick={() => hide(a.id)} aria-label="Dismiss"><Icon name="x" /></button>
    </aside>
  ));
}

/* Right column: level, live challenges (one-tap check-in), stats, perfect days, the week. */
function SidePanel({ o, todayKey }) {
  const { w } = useLook();
  const { commit, toast } = useGame();
  const [over, setOver] = useState({});
  const pct = (o.xp_into_level / o.xp_per_level) * 100;
  const live = (o.challenges || []).filter((c) => c.status === "active");

  const checkin = async (c) => {
    const want = !(c.id in over ? over[c.id] : c.checked_today);
    setOver((m) => ({ ...m, [c.id]: want }));
    try {
      const res = await api.checkinChallenge(c.id, todayKey, want);
      commit(res);
      setOver((m) => { const n = { ...m }; delete n[c.id]; return n; });
    } catch (err) {
      setOver((m) => { const n = { ...m }; delete n[c.id]; return n; });
      toast({ kind: "bad", emoji: "⚠️", title: "That didn't save", body: err.message });
    }
  };

  return (
    <>
      <section className="card" aria-label={w.panelStatus}>
        <div className="level-top">
          <RankBadge rank={o.rank} size={78} emoji={o.title_emoji} />
          <div className="grow">
            <h2 className="who-name display">{o.hunter_name}</h2>
            <span className="chip accent">{w.style === "calm" ? o.title_calm : o.title}</span>
          </div>
          <Avatar name={o.hunter_name} avatar={o.avatar} size={44} />
        </div>
        <div className="level-row"><b className="display" style={{ fontSize: "1.4rem" }}>{w.levelWord} {o.level}</b><span className="spacer" /><span className="small muted">{o.xp_into_level} / {o.xp_per_level} XP</span></div>
        <Bar value={pct} label="Progress to next level" />
        <p className="small muted" style={{ marginTop: 8 }}>
          {o.next_rank ? `⬆️ ${o.next_rank.xp_to_go} XP to ${w.rankLabel(o.next_rank.rank)} (level ${o.next_rank.level}).` : w.topRank}
        </p>
        <dl className="kpis">
          <div><dt>🔥 Streak</dt><dd className="num">{o.current_streak}</dd></div>
          <div><dt>🏅 Best</dt><dd className="num">{o.longest_streak}</dd></div>
          <div><dt>🪙 Coins</dt><dd className="num gold-text">{o.coins}</dd></div>
        </dl>
      </section>

      <section className="card" aria-label="My challenges">
        <div className="card-head"><h3 className="card-title">🎯 My challenges</h3><a className="card-sub" href="#/challenges">See all</a></div>
        {live.length === 0 ? (
          <p className="small muted">Build your own challenge, like "Walk 20 minutes" for 10 days. <a href="#/challenges">Start one</a> 🚀</p>
        ) : live.map((c) => {
          const checked = c.id in over ? over[c.id] : c.checked_today;
          return (
            <div className="mini" key={c.id}>
              <span className="emoji" aria-hidden="true">{c.emoji}</span>
              <div className="mini-body"><b>{c.title}</b><span className="small muted">{c.done} of {c.target}</span></div>
              <button type="button" className={`btn sm${checked ? " ghost" : ""}`} aria-pressed={checked} onClick={() => checkin(c)}
                aria-label={`${checked ? "Undo check-in for" : "Check in for"} ${c.title}`}>{checked ? "✅" : "Check in"}</button>
            </div>
          );
        })}
      </section>

      <section className="card" aria-label={w.statsTitle}>
        <div className="card-head"><h3 className="card-title">📊 {w.statsTitle}</h3><span className="card-sub">{w.statsSub}</span></div>
        <Radar totals={o.stat_totals} />
      </section>

      <section className="card sm" aria-label={w.armyTitle}>
        <div className="row">
          <span className="emoji" style={{ fontSize: "2rem" }} aria-hidden="true">{w.armyEmoji}</span>
          <div className="grow">
            <b className="display" style={{ fontSize: "1.5rem" }}>{o.perfect_days}</b> <span className="muted">{o.perfect_days === 1 ? w.armyUnit : w.armyUnits}</span>
            <div className="small faint">{o.perfect_days === 0 ? w.armyEmpty : w.armyHint}</div>
          </div>
        </div>
      </section>

      <section className="card sm" aria-label="This week">
        <div className="row">
          <div className="grow"><b className="display">This week 📅</b><div className="small muted">{o.week.avg}% average completion</div></div>
          <div className="stars" role="img" aria-label={`${o.week.stars} of 5 stars`}>
            {[1, 2, 3, 4, 5].map((i) => <span key={i} className={`emoji${i <= o.week.stars ? " on" : ""}`}>⭐</span>)}
          </div>
        </div>
      </section>
    </>
  );
}

function JournalCard({ dateKey, initial, onSaved }) {
  const { toast } = useGame();
  const { w } = useLook();
  const [mood, setMood] = useState(initial ? initial.mood : null);
  const [note, setNote] = useState(initial ? initial.note : "");
  const [struggle, setStruggle] = useState(initial ? initial.struggle : "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(!!initial);
  const dirty = (set) => (e) => { set(e.target.value); setSaved(false); };

  const save = async () => {
    setBusy(true);
    try {
      const res = await api.saveJournal(dateKey, { mood, note, struggle });
      setSaved(true);
      onSaved(res);
    } catch (err) {
      toast({ kind: "bad", emoji: "⚠️", title: "Couldn't save your log", body: err.message });
    } finally { setBusy(false); }
  };
  const remove = async () => {
    try {
      await api.deleteJournal(dateKey);
      setMood(null); setNote(""); setStruggle(""); setSaved(false);
    } catch (err) { toast({ kind: "bad", emoji: "⚠️", title: "Couldn't delete", body: err.message }); }
  };

  return (
    <section className="card journal" aria-label="Daily log">
      <div className="card-head">
        <h3 className="card-title">📔 Daily log</h3>
        <span className="card-sub"><Icon name="lock" className="sm" /> Private. Only you can read this.</span>
      </div>
      <div className="field">
        <span className="label" id="mood-label">How did today feel?</span>
        <div className="moods" role="radiogroup" aria-labelledby="mood-label">
          {MOOD_LIST.map(([v, emoji, label]) => (
            <button key={v} type="button" role="radio" aria-checked={mood === v} className="mood" onClick={() => { setMood(v); setSaved(false); }}>
              <span className="emoji" aria-hidden="true">{emoji}</span>{label}
            </button>
          ))}
        </div>
      </div>
      <div className="field"><label htmlFor={`note-${dateKey}`}>✍️ What happened?</label>
        <textarea id={`note-${dateKey}`} className="textarea" value={note} onChange={dirty(setNote)} maxLength={2000} placeholder="Wins, surprises, anything worth remembering." /></div>
      <div className="field"><label htmlFor={`hard-${dateKey}`}>🧗 What was hard?</label>
        <textarea id={`hard-${dateKey}`} className="textarea" value={struggle} onChange={dirty(setStruggle)} maxLength={2000}
          placeholder={w.style === "calm" ? "Anything that got in the way, so you can plan around it." : "Pain is data. Write it down so you can beat it."} /></div>
      <div className="row">
        <button type="button" className="btn" onClick={save} disabled={busy || (!mood && !note.trim() && !struggle.trim())}>{busy ? "Saving…" : "Save log"}</button>
        {saved ? <span className="chip ok">✅ Saved</span> : null}
        <span className="spacer" />
        {(initial || saved) && <button type="button" className="link-btn small" onClick={remove}>Delete entry</button>}
      </div>
    </section>
  );
}
