import { useCallback, useEffect, useState } from "react";
import Avatar from "./Avatar";
import { Empty, ErrorNote, Skeletons } from "./ui";
import { api } from "../api";
import { useAuth } from "../auth";
import { useGame } from "../game";
import { useLook } from "../look";
import { formatShort, parseKey } from "../dateUtils";

const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };

function Podium({ rows }) {
  const { w } = useLook();
  const order = [rows[1], rows[0], rows[2]].filter(Boolean);   // 2nd, 1st, 3rd
  return (
    <ol className="podium" aria-label="Top three this week">
      {order.map((r) => (
        <li key={r.place} className={`podium-slot place-${r.place}${r.is_me ? " is-me" : ""}`}>
          <span className="podium-medal emoji" aria-hidden="true">{MEDAL[r.place]}</span>
          <Avatar name={r.name} avatar={r.avatar} size={r.place === 1 ? 64 : 52} />
          <b className="podium-name">{r.name}{r.is_me ? " (you)" : ""}</b>
          <span className="small muted">{w.levelWord} {r.level}, {w.rankLabel(r.rank)}</span>
          <div className="podium-block"><span className="num">{r.week_xp}</span></div>
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
      toast({ emoji: value ? "🏆" : "👋", title: value ? "You're on the board!" : "You're no longer listed" });
    } catch (e) {
      toast({ kind: "bad", emoji: "⚠️", title: "Couldn't change that", body: e.message });
    }
    setBusy(false);
  };

  if (error && !board) return <ErrorNote error={error} />;
  if (!board) return <Skeletons n={2} h={200} />;

  const top = board.rows.slice(0, 3);
  const rest = board.rows.slice(3);
  const max = Math.max(...board.rows.map((r) => r.week_xp), 1);

  return (
    <div className="stack">
      <section className="card tint wallet">
        <div>
          <div className="muted small">📅 This week</div>
          <div className="display" style={{ fontSize: "1.6rem" }}>{formatShort(parseKey(board.week_start))} to {formatShort(parseKey(board.week_end))}</div>
        </div>
        <p className="muted wallet-note">
          Points come from {w.habitsLower}, perfect days, daily dares and weekly bosses. The board resets every Monday. 🔄
          {board.opted_in && board.me ? <> You are <b>number {board.me.place}</b> of {board.participants}. 🎉</> : null}
        </p>
      </section>

      {!board.opted_in && (
        <section className="card lift row wrap">
          <span className="emoji" style={{ fontSize: "2.4rem" }} aria-hidden="true">🏆</span>
          <div className="grow">
            <h3 className="display">Want to compete with friends?</h3>
            <p className="muted">
              Joining shows your name, avatar, level, streak and this week's points to other members.
              Nothing else is shared: your {w.habitsLower}, journal and coins stay private. You can leave at any time.
            </p>
          </div>
          <button type="button" className="btn" onClick={() => setOpt(true)} disabled={busy}>🙋 {w.joinBoard}</button>
        </section>
      )}

      {board.rows.length === 0 ? (
        <section className="card"><Empty emoji="🏁" title="No one is on the board yet">{board.opted_in ? "You are the first one here." : "Be the first: join above and set the pace."}</Empty></section>
      ) : (
        <section className="card">
          <div className="card-head"><h3 className="card-title">🏆 {w.hall}</h3><span className="card-sub">{board.participants} {board.participants === 1 ? "member" : "members"}</span></div>
          <Podium rows={top} />
          {rest.length > 0 && (
            <ol className="board" start={4}>
              {rest.map((r) => (
                <li key={r.place} className={r.is_me ? "is-me" : ""}>
                  <span className="board-place num">{r.place}</span>
                  <Avatar name={r.name} avatar={r.avatar} size={38} />
                  <span className="grow">
                    <b>{r.name}{r.is_me ? " (you)" : ""}</b>
                    <span className="small muted board-sub">{w.levelWord} {r.level}, {w.rankLabel(r.rank)}<span>🔥 {r.streak}</span></span>
                    <span className="board-bar" aria-hidden="true"><i style={{ width: `${(r.week_xp / max) * 100}%` }} /></span>
                  </span>
                  <span className="num">{r.week_xp}<small className="faint"> pts</small></span>
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
