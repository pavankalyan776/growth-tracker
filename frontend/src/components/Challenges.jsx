import { useState } from "react";
import Icon from "./icons";
import { api } from "../api";
import { useGame } from "../game";
import { useLook } from "../look";
import { formatLong, parseKey } from "../dateUtils";

const CATEGORY_ICON = { body: "bolt", mind: "brain", kind: "heart", home: "home" };

/* A small optional challenge for the day. It never affects your streak: it is pure bonus. */
export function DareCard({ dare, dateKey, isToday, onChanged }) {
  const { announce, toast, refresh } = useGame();
  const { w } = useLook();
  const [done, setDone] = useState(dare.done);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    const want = !done;
    setBusy(true);
    setDone(want);
    try {
      const res = await api.toggleDare(dateKey, want);
      announce(res.events);
      if (want) toast({ kind: "coin", icon: "dice", title: `+${res.xp_delta} XP`, body: res.level_up ? `Level ${res.level}` : "Dare done" });
      await refresh();
      if (onChanged) onChanged();
    } catch (err) {
      setDone(!want);
      toast({ icon: "alert", title: "That didn't save", body: err.message });
    } finally { setBusy(false); }
  };

  return (
    <section className={`panel challenge dare${done ? " is-done" : ""}`} aria-label={w.dare}>
      <div className="challenge-head">
        <span className="challenge-icon" aria-hidden="true"><Icon name={CATEGORY_ICON[dare.category] || "dice"} /></span>
        <span className="challenge-kicker">{isToday ? w.dare : `${w.dare}, ${formatLong(parseKey(dateKey))}`}</span>
      </div>
      <h3 className="challenge-title">{dare.label}</h3>
      <p className="small muted">{dare.hint}</p>
      <div className="challenge-foot">
        <span className="chip coral"><Icon name="bolt" />+{dare.xp} XP</span>
        <span className="chip gold"><Icon name="coin" />+{dare.coins}</span>
        <span className="spacer" />
        <button type="button" className={`btn sm${done ? " ghost" : ""}`} onClick={toggle} disabled={busy} aria-pressed={done}>
          <Icon name={done ? "check" : "dice"} className="sm" />{done ? `Done. ${w.dareUndo}` : w.dareDo}
        </button>
      </div>
    </section>
  );
}

/* The weekly boss: its health is the share of this week's quests you still have to clear. */
export function BossCard({ boss }) {
  const { w, style } = useLook();
  const adventure = style === "adventure";
  const pctHp = boss.hp ? (boss.remaining / boss.hp) * 100 : 0;
  const pctDone = boss.hp ? (boss.damage / boss.hp) * 100 : 0;
  const title = adventure
    ? boss.name
    : `Do ${boss.hp} of this week's ${boss.possible} ${w.habitsLower}`;

  return (
    <section className={`panel challenge boss${boss.defeated ? " is-done" : ""}`} aria-label={w.boss}>
      <div className="challenge-head">
        <span className="challenge-icon" aria-hidden="true"><Icon name={adventure ? "swords" : "target"} /></span>
        <span className="challenge-kicker">{boss.defeated ? w.bossDone : w.boss}</span>
      </div>
      <h3 className="challenge-title">{title}</h3>

      <div className={`hp${adventure ? " is-hp" : ""}`} role="progressbar" aria-label={w.bossHp}
        aria-valuemin={0} aria-valuemax={boss.hp} aria-valuenow={adventure ? boss.remaining : boss.damage}>
        <i style={{ width: `${adventure ? pctHp : pctDone}%` }} />
      </div>
      <div className="hp-caption small">
        {boss.defeated
          ? <b>{adventure ? "Defeated. Everything else this week is a bonus." : "Goal reached. Everything else this week is a bonus."}</b>
          : adventure
            ? <span><b>{boss.remaining}</b> {boss.remaining === 1 ? "hit" : "hits"} left of {boss.hp}. Every {w.habit} you clear is one hit.</span>
            : <span><b>{boss.damage}</b> of {boss.hp} done. <b>{boss.remaining}</b> to go.</span>}
      </div>
      <div className="challenge-foot">
        <span className="chip"><Icon name="clock" />{boss.days_left === 0 ? "Last day" : `${boss.days_left} ${boss.days_left === 1 ? "day" : "days"} left`}</span>
        <span className="chip gold"><Icon name="coin" />+{boss.reward_coins}</span>
        <span className="chip coral"><Icon name="bolt" />+{boss.reward_xp} XP</span>
      </div>
    </section>
  );
}
