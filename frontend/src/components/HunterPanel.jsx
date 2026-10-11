import Icon from "./icons";
import RankEmblem from "./RankEmblem";
import Radar from "./Radar";
import { useLook } from "../look";

function Soldier() {
  return (
    <svg viewBox="0 0 24 28" className="soldier" aria-hidden="true">
      <path d="M12 2a5 5 0 0 1 5 5v2.5a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5zM3 28c0-6 3-10 9-10s9 4 9 10z" />
      <circle cx="10" cy="8" r="1.1" className="eye" /><circle cx="14" cy="8" r="1.1" className="eye" />
    </svg>
  );
}

export function ShadowArmy({ count }) {
  const { w } = useLook();
  const shown = Math.min(count, 12);
  return (
    <div className="army">
      <div className="row">
        <b className="num army-count">{count}</b>
        <span className="muted small">{count === 1 ? w.armyUnit : w.armyUnits}<br />{w.armyHint}</span>
      </div>
      <div className="army-row" aria-hidden="true">
        {Array.from({ length: shown }, (_, i) => (w.style === "calm" ? <Icon key={i} name="leaf" className="lg sprout" /> : <Soldier key={i} />))}
        {count > shown ? <span className="chip">+{count - shown}</span> : null}
        {count === 0 ? <span className="faint small">{w.armyEmpty}</span> : null}
      </div>
    </div>
  );
}

export default function HunterPanel({ o }) {
  const { w } = useLook();
  const pct = (o.xp_into_level / o.xp_per_level) * 100;
  return (
    <div className="stack">
      <section className="panel hunter" aria-label={w.panelStatus}>
        <div className="hunter-head">
          <RankEmblem rank={o.rank} size={92} />
          <div className="grow">
            <h2 className="display hunter-name">{o.hunter_name}</h2>
            <span className="chip accent">{w.style === "calm" ? o.title_calm : o.title}</span>
          </div>
        </div>

        <div className="level-block">
          <div className="row"><b className="display" style={{ fontSize: "1.5rem" }}>{w.levelWord} {o.level}</b><span className="spacer" /><span className="small muted">{o.xp_into_level} / {o.xp_per_level} {w.style === "calm" ? "points" : "XP"}</span></div>
          <div className="xpbar" role="progressbar" aria-valuenow={o.xp_into_level} aria-valuemin={0} aria-valuemax={o.xp_per_level} aria-label="Progress to next level"><i style={{ width: `${pct}%` }} /></div>
          <p className="small muted">
            {o.next_rank
              ? `${o.next_rank.xp_to_go} ${w.style === "calm" ? "points" : "XP"} to ${w.rankLabel(o.next_rank.rank)} (level ${o.next_rank.level}).`
              : w.topRank}
          </p>
        </div>

        <dl className="kpis">
          <div><dt><Icon name="flame" className="sm" />Streak</dt><dd className="num">{o.current_streak}</dd></div>
          <div><dt><Icon name="star" className="sm" />Best</dt><dd className="num">{o.longest_streak}</dd></div>
          <div><dt><Icon name="coin" className="sm" />Coins</dt><dd className="num gold-text">{o.coins}</dd></div>
        </dl>
      </section>

      <section className="panel" aria-label={w.statsTitle}>
        <div className="panel-head"><h3 className="panel-title">{w.statsTitle}</h3><span className="panel-sub">{w.statsSub}</span></div>
        <Radar totals={o.stat_totals} />
      </section>

      <section className="panel sm" aria-label={w.armyTitle}>
        <ShadowArmy count={o.perfect_days} />
      </section>

      <section className="panel sm" aria-label="This week">
        <div className="row">
          <div className="grow">
            <b className="display" style={{ fontSize: "1.25rem" }}>This week</b>
            <div className="small muted">{o.week.avg}% average completion</div>
          </div>
          <div className="stars" role="img" aria-label={`${o.week.stars} of 5 stars`}>
            {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" className={i <= o.week.stars ? "on" : ""} />)}
          </div>
        </div>
      </section>
    </div>
  );
}
