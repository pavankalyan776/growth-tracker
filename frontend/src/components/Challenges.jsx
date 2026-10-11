import { memo, useState } from "react";
import Icon from "./icons";
import { Bar, Dialog, EmojiPicker } from "./ui";
import { api } from "../api";
import { useGame } from "../game";
import { useLook } from "../look";
import { addDays, formatFull, formatLong, formatShort, getToday, parseKey, toKey } from "../dateUtils";

const CATEGORY_LABEL = { body: "Body 💪", mind: "Mind 🧠", kind: "Kindness 💌", home: "Home 🏠" };

/* A small optional dare for the day. It never touches your streak: pure bonus. */
export function DareCard({ dare, dateKey, isToday, onResult }) {
  const { commit, toast } = useGame();
  const { w } = useLook();
  const [done, setDone] = useState(dare.done);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    const want = !done;
    setBusy(true);
    setDone(want);
    try {
      const res = await api.toggleDare(dateKey, want);
      commit(res);
      if (onResult) onResult(res);
      if (want) toast({ kind: "coin", emoji: dare.emoji || "🎲", title: `+${res.xp_delta} XP`, body: res.level_up ? `Level ${res.level}!` : "Dare done. Nice!" });
    } catch (err) {
      setDone(!want);
      toast({ kind: "bad", emoji: "⚠️", title: "That didn't save", body: err.message });
    } finally { setBusy(false); }
  };

  return (
    <section className={`card cc${done ? " is-done" : ""}`} aria-label={w.dare}>
      <div className="cc-head">
        <span className="cc-emoji emoji" aria-hidden="true">{dare.emoji || "🎲"}</span>
        <div>
          <div className="cc-kicker">{isToday ? `🎲 ${w.dare}` : `🎲 ${w.dare}, ${formatLong(parseKey(dateKey))}`}</div>
          <div className="small faint">{CATEGORY_LABEL[dare.category] || ""}</div>
        </div>
      </div>
      <h3 className="cc-title">{dare.label}</h3>
      <p className="small muted">{dare.hint}</p>
      <div className="cc-foot">
        <span className="chip accent">✨ +{dare.xp} XP</span>
        <span className="chip gold">🪙 +{dare.coins}</span>
        <span className="spacer" />
        <button type="button" className={`btn sm${done ? " ghost" : ""}`} onClick={toggle} disabled={busy} aria-pressed={done}>
          {done ? `✅ Done · ${w.dareUndo}` : `🎲 ${w.dareDo}`}
        </button>
      </div>
    </section>
  );
}

/* The weekly boss: its health is the share of this week's quests you still have to clear. */
export function BossCard({ boss }) {
  const { w, style } = useLook();
  const adventure = style === "adventure";
  const title = adventure ? boss.name : `Do ${boss.hp} of this week's ${boss.possible} ${w.habitsLower}`;
  const left = boss.days_left === 0 ? "Last day" : `${boss.days_left} ${boss.days_left === 1 ? "day" : "days"} left`;
  return (
    <section className={`card cc${boss.defeated ? " is-done" : ""}`} aria-label={w.boss}>
      <div className="cc-head">
        <span className="cc-emoji emoji" aria-hidden="true">{boss.defeated ? "🏆" : adventure ? boss.emoji || "👹" : "🎯"}</span>
        <div>
          <div className="cc-kicker">{boss.defeated ? `🏆 ${w.bossDone}` : `⚔️ ${w.boss}`}</div>
          <div className="small faint">⏳ {left}</div>
        </div>
      </div>
      <h3 className="cc-title">{title}</h3>
      <Bar tone="boss" thin={false} label={w.bossHp} max={boss.hp} value={adventure ? boss.remaining : boss.damage} />
      <p className="small">
        {boss.defeated
          ? <b>{adventure ? "Defeated! Everything else this week is a bonus. 🎉" : "Goal reached! Everything else this week is a bonus. 🎉"}</b>
          : adventure
            ? <span><b>{boss.remaining}</b> {boss.remaining === 1 ? "hit" : "hits"} left of {boss.hp}. Every {w.habit} you clear is one hit. 💥</span>
            : <span><b>{boss.damage}</b> of {boss.hp} done. <b>{boss.remaining}</b> to go. 💪</span>}
      </p>
      <div className="cc-foot">
        <span className="chip gold">🪙 +{boss.reward_coins}</span>
        <span className="chip accent">✨ +{boss.reward_xp} XP</span>
      </div>
    </section>
  );
}

const STATUS_CHIP = {
  active: ["accent", "🔥 In progress"], upcoming: ["info", "🗓️ Starts soon"], done: ["ok", "✅ Finished"],
  missed: ["danger", "⌛ Time ran out"], archived: ["", "📦 Archived"],
};

/* A challenge a member built. Check in once a day until the target is reached. */
export const ChallengeCard = memo(function ChallengeCard({ c, todayKey, onChange, reward }) {
  const { commit, toast } = useGame();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(c.checked_today);
  const [confirm, setConfirm] = useState(false);
  const [chip, label] = STATUS_CHIP[c.status] || ["", c.status];
  const live = c.status === "active";

  const checkin = async () => {
    const want = !checked;
    setChecked(want);
    setBusy(true);
    try {
      const res = await api.checkinChallenge(c.id, todayKey, want);
      commit(res);
      setChecked(res.challenge.checked_today);
      onChange(res.challenge);
    } catch (err) {
      setChecked(!want);
      toast({ kind: "bad", emoji: "⚠️", title: "That didn't save", body: err.message });
    } finally { setBusy(false); }
  };
  const archive = async (value) => {
    setBusy(true);
    try { const res = await api.archiveChallenge(c.id, value); commit(res); onChange(res.challenge); }
    catch (err) { toast({ kind: "bad", emoji: "⚠️", title: "Couldn't update", body: err.message }); }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true);
    try { await api.deleteChallenge(c.id); onChange(null, c.id); }
    catch (err) { toast({ kind: "bad", emoji: "⚠️", title: "Couldn't delete", body: err.message }); setBusy(false); }
  };

  const pips = Math.min(c.target, 30);
  const doneRatio = c.target ? c.done / c.target : 0;
  return (
    <section className={`card cc${c.status === "done" ? " is-done" : ""}${c.status === "missed" || c.status === "archived" ? " is-missed" : ""}`} aria-label={c.title}>
      <div className="cc-head">
        <span className="cc-emoji emoji" aria-hidden="true">{c.emoji}</span>
        <div className="grow">
          <h3 className="cc-title">{c.title}</h3>
          <div className="small faint">{formatShort(parseKey(c.start))} → {formatShort(parseKey(c.end))}{live ? ` · ${c.days_left} left` : ""}</div>
        </div>
        <span className={`chip ${chip}`}>{label}</span>
      </div>
      <div className="cc-days" aria-hidden="true">
        {Array.from({ length: pips }, (_, i) => <i key={i} className={i < Math.round(doneRatio * pips) ? "on" : ""} />)}
      </div>
      <Bar value={c.done} max={c.target} label={`${c.done} of ${c.target} check-ins`} thin />
      <p className="small"><b>{c.done}</b> of {c.target} check-ins{c.status === "done" ? " 🎉" : ""}</p>
      <div className="cc-foot">
        {reward && c.status !== "done" ? <><span className="chip gold">🪙 +{c.coins}</span><span className="chip accent">✨ +{c.xp} XP</span></> : null}
        {c.status === "done" && !c.rewarded ? <span className="chip">Weekly reward limit reached</span> : null}
        {c.status === "done" && c.rewarded ? <span className="chip gold">🪙 +{c.coins} · ✨ +{c.xp} XP earned</span> : null}
        <span className="spacer" />
        {live && (
          <button type="button" className={`btn sm${checked ? " ghost" : ""}`} onClick={checkin} disabled={busy} aria-pressed={checked}>
            {checked ? "✅ Checked in · Undo" : "☑️ Check in today"}
          </button>
        )}
        {(c.status === "done" || c.status === "missed") && (
          <button type="button" className="btn ghost sm" onClick={() => archive(true)} disabled={busy}>📦 Archive</button>
        )}
        {c.status === "archived" && <button type="button" className="btn ghost sm" onClick={() => archive(false)} disabled={busy}>Restore</button>}
        {c.status !== "done" && c.status !== "archived" && !confirm && (
          <button type="button" className="icon-btn" onClick={() => setConfirm(true)} aria-label={`Delete ${c.title}`}><Icon name="trash" /></button>
        )}
        {confirm && (
          <span className="row">
            <button type="button" className="btn danger sm" onClick={remove} disabled={busy}>Delete</button>
            <button type="button" className="btn ghost sm" onClick={() => setConfirm(false)}>Keep</button>
          </span>
        )}
      </div>
    </section>
  );
});

const TEMPLATES = [
  { emoji: "💧", title: "Drink 8 glasses of water", target: 14, days: 14 },
  { emoji: "🚶", title: "Walk for 20 minutes", target: 10, days: 14 },
  { emoji: "📚", title: "Read 10 pages", target: 20, days: 30 },
  { emoji: "📵", title: "Phone down by 10 PM", target: 7, days: 10 },
];

/* The no-code builder: pick an emoji, name it, say how many check-ins and how long. */
export function ChallengeBuilder({ onClose, onCreated, planEnd }) {
  const { commit, toast } = useGame();
  const today = getToday();
  const [form, setForm] = useState({ title: "", emoji: "🎯", target: 7, days: 14, offset: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const start = addDays(today, form.offset);
  const end = addDays(start, form.days - 1);
  const pastPlan = planEnd && end > parseKey(planEnd);
  const tooShort = form.target > form.days;
  const invalid = form.title.trim().length < 2 || tooShort || pastPlan;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await api.createChallenge({
        title: form.title.trim(), emoji: form.emoji || "🎯", target: form.target, days: form.days, start_date: toKey(start),
      });
      commit(res);
      toast({ kind: "coin", emoji: form.emoji || "🎯", title: "Challenge created", body: "Check in once a day to finish it." });
      onCreated(res.challenge);
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <Dialog title="Build a challenge 🎯" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <span className="label">Quick start</span>
          <div className="row wrap">
            {TEMPLATES.map((t) => (
              <button key={t.title} type="button" className="chip" onClick={() => setForm((f) => ({ ...f, ...t }))}>{t.emoji} {t.title}</button>
            ))}
          </div>
        </div>
        <div className="field"><label htmlFor="ch-title">What will you do?</label>
          <input id="ch-title" className="input" value={form.title} maxLength={60} placeholder="Stretch every morning"
            onChange={(e) => set("title", e.target.value)} /></div>
        <EmojiPicker value={form.emoji} onChange={(v) => set("emoji", v)} set="challenge" label="Pick an emoji" />
        <div className="field">
          <label htmlFor="ch-target">Check-ins to finish: <b>{form.target}</b></label>
          <div className="range-row"><input id="ch-target" type="range" min="3" max="90" value={form.target} onChange={(e) => set("target", Number(e.target.value))} /><output>{form.target}</output></div>
        </div>
        <div className="field">
          <label htmlFor="ch-days">Time to do it: <b>{form.days} days</b></label>
          <div className="range-row"><input id="ch-days" type="range" min="3" max="90" value={form.days} onChange={(e) => set("days", Number(e.target.value))} /><output>{form.days}</output></div>
        </div>
        <div className="field">
          <label htmlFor="ch-start">Starts</label>
          <select id="ch-start" className="select" value={form.offset} onChange={(e) => set("offset", Number(e.target.value))}>
            <option value={0}>Today</option><option value={1}>Tomorrow</option><option value={7}>In a week</option>
          </select>
        </div>
        <div className="builder-preview" aria-live="polite">
          <span className="cc-emoji emoji" aria-hidden="true">{form.emoji || "🎯"}</span>
          <div>
            <b>{form.title.trim() || "Your challenge"}</b>
            <div className="small muted">{form.target} check-ins between {formatFull(start)} and {formatFull(end)}. Finish it for 🪙 +15 and ✨ +30 XP.</div>
          </div>
        </div>
        {tooShort && <p className="error-text" role="alert">You need at least as many days as check-ins.</p>}
        {pastPlan && <p className="error-text" role="alert">That would run past the end of your plan ({formatFull(parseKey(planEnd))}). Shorten it.</p>}
        {error && <div className="alert error" role="alert"><Icon name="alert" />{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={busy || invalid}>{busy ? "Creating…" : "Create challenge"}</button>
        </div>
      </form>
    </Dialog>
  );
}
