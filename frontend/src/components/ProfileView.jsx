import { useState } from "react";
import Appearance from "./Appearance";
import Avatar, { AVATARS } from "./Avatar";
import Icon from "./icons";
import { api } from "../api";
import { useAuth } from "../auth";
import { useGame } from "../game";
import { useLook } from "../look";

function Section({ title, sub, children, tone }) {
  return (
    <section className={`card ${tone || ""}`}>
      <div className="card-head"><h3 className="card-title">{title}</h3>{sub ? <span className="card-sub">{sub}</span> : null}</div>
      {children}
    </section>
  );
}

export default function ProfileView({ trackerReady }) {
  const { user, setUser, adopt, signOut } = useAuth();
  const game = useGame();
  const { w } = useLook();
  const [name, setName] = useState(user.name);
  const [plan, setPlan] = useState({ start: user.plan_start || "", end: user.plan_end || "" });
  const [pw, setPw] = useState({ current: "", next: "" });
  const [delPw, setDelPw] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState({});   // per-section feedback: { key: {ok, text} }
  const say = (key, ok, text) => setMsg((m) => ({ ...m, [key]: { ok, text } }));
  const msgBox = (k) => (msg[k] ? <div className={`alert ${msg[k].ok ? "ok" : "error"}`} role={msg[k].ok ? "status" : "alert"}><Icon name={msg[k].ok ? "check" : "alert"} />{msg[k].text}</div> : null);

  const run = (k, fn, okText) => async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try { await fn(); say(k, true, okText); } catch (err) { say(k, false, err.message); }
  };

  return (
    <div className="profile-grid">
      <Section title="🙂 Account" sub={user.email}>
        <form onSubmit={run("name", async () => { setUser(await api.updateProfile({ name: name.trim() })); if (game) game.refresh(); }, "Name updated.")}>
          <div className="field"><label htmlFor="pname">{w.yourName}</label>
            <input id="pname" className="input" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} /></div>
          <div className="row wrap">
            <button type="submit" className="btn" disabled={name.trim().length < 2 || name.trim() === user.name}>Save name</button>
            <span className={`chip ${user.role === "admin" ? "info" : "accent"}`}>{user.role === "admin" ? "🛡️ Admin" : w.style === "calm" ? "🙂 Member" : "⚔️ Hunter"}</span>
          </div>
          {msgBox("name")}
        </form>
      </Section>

      <Section title="🎨 Appearance" sub="Saved on this device">
        <Appearance />
        <p className="help" style={{ marginTop: 4 }}>{`Colours and titles are unlocked in ${w.rewards}.`}</p>
      </Section>

      <Section title="🦊 Avatar" sub="Shown next to your name">
        <div className="avatar-grid" role="radiogroup" aria-label="Choose an avatar">
          {AVATARS.map((a) => (
            <button key={a} type="button" role="radio" aria-checked={user.avatar === a} aria-label={a}
              className={`avatar-pick${user.avatar === a ? " is-on" : ""}`}
              onClick={run("avatar", async () => { setUser(await api.updateProfile({ avatar: a })); if (game) game.refresh(); }, "Avatar updated.")}>
              <Avatar name={user.name} avatar={a} size={44} />
            </button>
          ))}
        </div>
        {msgBox("avatar")}
      </Section>

      {trackerReady && (
        <Section title={`🏆 ${w.hall}`} sub="Optional, off by default">
          <p className="muted" style={{ marginBottom: 12 }}>
            {user.public_board
              ? `You are on the ${w.hall.replace("The ", "").toLowerCase()}. Other members can see your name, avatar, level, streak and this week's points.`
              : `Join to compete with other members. Only your name, avatar, level, streak and weekly points would be visible. Your ${w.habitsLower}, journal and coins stay private.`}
          </p>
          <button type="button" className={`btn${user.public_board ? " ghost" : ""}`}
            onClick={run("board", async () => { setUser(await api.updateProfile({ public_board: !user.public_board })); }, user.public_board ? "You left." : "You joined.")}>
            🏆 {user.public_board ? w.leaveBoard : w.joinBoard}
          </button>
          {msgBox("board")}
        </Section>
      )}

      {trackerReady && (
        <Section title="🧭 Plan window" sub="Streaks, XP and coins count inside it">
          <form onSubmit={run("plan", async () => { setUser(await api.updatePlan(plan.start, plan.end)); if (game) await game.refresh(); }, "Plan window updated.")}>
            <div className="grid-2">
              <div className="field"><label htmlFor="pst">Starts</label><input id="pst" type="date" className="input" value={plan.start} onChange={(e) => setPlan({ ...plan, start: e.target.value })} /></div>
              <div className="field"><label htmlFor="pen">Ends</label><input id="pen" type="date" className="input" value={plan.end} min={plan.start} onChange={(e) => setPlan({ ...plan, end: e.target.value })} /></div>
            </div>
            <p className="help">Days outside the window keep their history but stop counting toward streaks and XP.</p>
            <div style={{ marginTop: 12 }}><button type="submit" className="btn" disabled={!plan.start || !plan.end}>Save plan window</button></div>
            {msgBox("plan")}
          </form>
        </Section>
      )}

      <Section title="🔑 Password and sessions">
        <form onSubmit={run("pw", async () => { adopt(await api.changePassword(pw.current, pw.next)); setPw({ current: "", next: "" }); }, "Password changed. Other devices were signed out.")}>
          <div className="field"><label htmlFor="cur">Current password</label><input id="cur" type="password" className="input" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
          <div className="field"><label htmlFor="new">New password</label><input id="new" type="password" className="input" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <span className="help">At least 8 characters, with a letter and a number.</span></div>
          <div className="row wrap">
            <button type="submit" className="btn" disabled={!pw.current || pw.next.length < 8}>Change password</button>
            <button type="button" className="btn ghost" onClick={run("pw", async () => { await api.logoutEverywhere(); signOut("You were signed out on every device."); }, "")}>Sign out everywhere</button>
          </div>
          {msgBox("pw")}
        </form>
      </Section>

      <Section title="🔒 Privacy" sub="What admins can and can't see">
        <ul className="privacy-list">
          <li><span className="emoji" aria-hidden="true">👀</span><span><b>Admins can see:</b> your email, name, sign-up and last-active time, level, rank, streak and completion percentages.</span></li>
          <li><span className="emoji" aria-hidden="true">🙈</span><span><b>Admins can't see:</b> your journal entries, your {w.habit} names, which dares you did, or your password. There is no screen or endpoint that shows them.</span></li>
        </ul>
      </Section>

      <Section title="🗑️ Delete account" sub="Permanent" tone="danger-card">
        <p className="muted" style={{ marginBottom: 12 }}>{`This removes your account, ${w.habitsLower}, history, journal and coins. It can't be undone.`}</p>
        {!confirmDelete ? (
          <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>🗑️ Delete my account</button>
        ) : (
          <form onSubmit={run("del", async () => { await api.deleteAccount(delPw); signOut("Your account was deleted."); }, "")}>
            <div className="field"><label htmlFor="dpw">Type your password to confirm</label><input id="dpw" type="password" className="input" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} /></div>
            <div className="row"><button type="submit" className="btn danger" disabled={!delPw}>Delete forever</button><button type="button" className="btn ghost" onClick={() => { setConfirmDelete(false); setDelPw(""); }}>Cancel</button></div>
            {msgBox("del")}
          </form>
        )}
      </Section>
    </div>
  );
}
