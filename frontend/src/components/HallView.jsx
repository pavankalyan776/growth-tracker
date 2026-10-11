import { useCallback, useEffect, useState } from "react";
import Avatar from "./Avatar";
import Icon from "./icons";
import { api } from "../api";
import { useAuth } from "../auth";
import { useGame } from "../game";
import { useLook } from "../look";
import { formatShort, parseKey } from "../dateUtils";

function Podium({ rows }) {
  const { w } = useLook();
  // Visual order is 2nd, 1st, 3rd. Ranks are always shown as text too, so colour and height are not the only signal.
  const order = [rows[1], rows[0], rows[2]].filter(Boolean);
  return (
    <ol className="podium" aria-label="Top three this week">
      {order.map((r) => (
        <li key={r.place} className={`podium-slot place-${r.place}${r.is_me ? " is-me" : ""}`}>
          <Avatar name={r.name} avatar={r.avatar} size={r.place === 1 ? 64 : 52} />
          <b className="podium-name">{r.name}{r.is_me ? " (you)" : ""}</b>
          <span className="small muted">{w.levelWord} {r.level}, {w.rankLabel(r.rank)}</span>
          <div className="podium-block"><span className="num">{r.place}</span></div>
          <span className="podium-xp num">{r.week_xp}</span>
        </li>
      ))}
    </ol>
  );
}

export default function HallView() {
  const { setUser } = useAuth();
  const { refresh, toast } = useGame();
  const { w } = useLook();
  const [board, setBoard] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.getBoard().then(setBoard).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const setOpt = async (value) => {
    setBusy(true);
    try {
      setUser(await api.updateProfile({ public_board: value }));
      await Promise.all([load(), refresh()]);
      toast({ icon: "check", title: value ? `You're on the ${w.hall.replace("The ", "").toLowerCase()}` : "You're no longer listed" });
    } catch (e) {
      toast({ icon: "alert", title: "Couldn't change that", body: e.message });
    }
    setBusy(false);
  };

  if (error) return <div className="alert error" role="alert"><Icon name="alert" />{error}</div>;
  if (!board) return <div className="stack"><div className="skel" style={{ height: 140 }} /><div className="skel" style={{ height: 320 }} /></div>;

  const top = board.rows.slice(0, 3);
  const rest = board.rows.slice(3);
  const max = Math.max(...board.rows.map((r) => r.week_xp), 1);

  return (
    <div className="stack">
      <section className="panel tone wallet">
        <div>
          <div className="muted small">This week</div>
          <div className="display wallet-week">{formatShort(parseKey(board.week_start))} to {formatShort(parseKey(board.week_end))}</div>
        </div>
        <p className="muted wallet-note">
          Points come from {w.habitsLower}, perfect days, daily dares and weekly bosses. The board resets every Monday.
          {board.opted_in && board.me ? <> You are <b>number {board.me.place}</b> of {board.participants}.</> : null}
        </p>
      </section>

      {!board.opted_in && (
        <section className="panel accent join">
          <div className="grow">
            <h3 className="display join-title">Want to compete with friends?</h3>
            <p className="muted">
              Joining shows your name, avatar, {w.levelWord.toLowerCase()}, streak and this week's points to other members.
              Nothing else is shared: your {w.habitsLower}, journal and coins stay private. You can leave at any time.
            </p>
          </div>
          <button type="button" className="btn" onClick={() => setOpt(true)} disabled={busy}><Icon name="podium" className="sm" />{w.joinBoard}</button>
        </section>
      )}

      {board.rows.length === 0 ? (
        <section className="panel empty">
          <div className="display">No one is on the board yet</div>
          <p>{board.opted_in ? "You are the first one here." : "Be the first: join above and set the pace."}</p>
        </section>
      ) : (
        <section className="panel">
          <div className="panel-head"><h3 className="panel-title">{w.hall}</h3><span className="panel-sub">{board.participants} {board.participants === 1 ? "member" : "members"}</span></div>
          <Podium rows={top} />
          {rest.length > 0 && (
            <ol className="board" start={4}>
              {rest.map((r) => (
                <li key={r.place} className={r.is_me ? "is-me" : ""}>
                  <span className="board-place num">{r.place}</span>
                  <Avatar name={r.name} avatar={r.avatar} size={36} />
                  <span className="grow">
                    <b>{r.name}{r.is_me ? " (you)" : ""}</b>
                    <span className="small muted board-sub">{w.levelWord} {r.level}, {w.rankLabel(r.rank)}<span className="board-flame"><Icon name="flame" className="sm" />{r.streak}</span></span>
                    <span className="board-bar" aria-hidden="true"><i style={{ width: `${(r.week_xp / max) * 100}%` }} /></span>
                  </span>
                  <span className="num board-xp">{r.week_xp}<small> pts</small></span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {board.opted_in && (
        <p className="center-text small muted">
          You are visible here. <button type="button" className="link-btn" onClick={() => setOpt(false)} disabled={busy}>{w.leaveBoard}</button>
        </p>
      )}
    </div>
  );
}
