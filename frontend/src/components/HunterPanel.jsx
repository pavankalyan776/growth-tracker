import Icon from "./icons";
import RankEmblem from "./RankEmblem";
import Radar from "./Radar";

function Soldier() {
  return (
    <svg viewBox="0 0 24 28" className="soldier" aria-hidden="true">
      <path d="M12 2a5 5 0 0 1 5 5v2.5a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5zM3 28c0-6 3-10 9-10s9 4 9 10z" />
      <circle cx="10" cy="8" r="1.1" className="eye" /><circle cx="14" cy="8" r="1.1" className="eye" />
    </svg>
  );
}

export function ShadowArmy({ count }) {
  const shown = Math.min(count, 12);
  return (
    <div className="army">
      <div className="row">
        <b className="num army-count">{count}</b>
        <span className="muted small">{count === 1 ? "shadow soldier" : "shadow soldiers"}<br />one per perfect day</span>
      </div>
      <div className="army-row" aria-hidden="true">
        {Array.from({ length: shown }, (_, i) => <Soldier key={i} />)}
        {count > shown ? <span className="chip">+{count - shown}</span> : null}
        {count === 0 ? <span className="faint small">Clear every quest in a day to extract your first.</span> : null}
      </div>
    </div>
  );
}

export default function HunterPanel({ o }) {
  const pct = (o.xp_into_level / o.xp_per_level) * 100;
  return (
    <div className="stack">
      <section className="panel hunter" aria-label="Hunter status">
        <div className="hunter-head">
          <RankEmblem rank={o.rank} size={92} />
          <div className="grow">
            <h2 className="display hunter-name">{o.hunter_name}</h2>
            <span className="chip accent">{o.title}</span>
          </div>
        </div>

        <div className="level-block">
          <div className="row"><b className="display" style={{ fontSize: "1.5rem" }}>Level {o.level}</b><span className="spacer" /><span className="small muted">{o.xp_into_level} / {o.xp_per_level} XP</span></div>
          <div className="xpbar" role="progressbar" aria-valuenow={o.xp_into_level} aria-valuemin={0} aria-valuemax={o.xp_per_level} aria-label="XP to next level"><i style={{ width: `${pct}%` }} /></div>
          <p className="small muted">
            {o.next_rank
              ? `${o.next_rank.xp_to_go} XP to ${o.next_rank.rank}-rank (level ${o.next_rank.level}).`
              : "Top rank reached. You are the Shadow Monarch."}
          </p>
        </div>

        <dl className="kpis">
          <div><dt><Icon name="flame" className="sm" />Streak</dt><dd className="num">{o.current_streak}</dd></div>
          <div><dt><Icon name="star" className="sm" />Best</dt><dd className="num">{o.longest_streak}</dd></div>
          <div><dt><Icon name="coin" className="sm" />Coins</dt><dd className="num gold-text">{o.coins}</dd></div>
        </dl>
      </section>

      <section className="panel" aria-label="Stats">
        <div className="panel-head"><h3 className="panel-title">Stats</h3><span className="panel-sub">XP by quest type</span></div>
        <Radar totals={o.stat_totals} />
      </section>

      <section className="panel sm" aria-label="Shadow army">
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
