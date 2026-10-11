import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../icons";
import RankEmblem from "../RankEmblem";
import { auditLabel, auditTone } from "./auditLabels";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { timeAgo } from "../../dateUtils";

const COLUMNS = [
  { key: "name", label: "Hunter", sort: "name" },
  { key: "role", label: "Role" },
  { key: "rank", label: "Rank", sort: "level" },
  { key: "streak", label: "Streak", sort: "streak" },
  { key: "completion", label: "Completion", sort: "completion" },
  { key: "active", label: "Last active", sort: "active" },
  { key: "joined", label: "Joined", sort: "joined" },
];

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("joined");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const dq = useDebounced(q, 250);

  const load = useCallback(() => {
    api.adminUsers({ q: dq, role, status, sort, order, page, page_size: 15 })
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(e.message));
  }, [dq, role, status, sort, order, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [dq, role, status]);

  const sortBy = (key) => {
    if (sort === key) setOrder(order === "asc" ? "desc" : "asc");
    else { setSort(key); setOrder(key === "name" ? "asc" : "desc"); }
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="stack">
      <section className="panel sm filters">
        <div className="field grow"><label htmlFor="uq">Search</label>
          <div className="input-wrap"><input id="uq" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" /></div></div>
        <div className="field"><label htmlFor="ur">Role</label>
          <select id="ur" className="select" value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option><option value="user">Hunters</option><option value="admin">Admins</option></select></div>
        <div className="field"><label htmlFor="us">Status</label>
          <select id="us" className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option><option value="active">Active</option><option value="disabled">Disabled</option></select></div>
      </section>

      {error && <div className="alert error" role="alert"><Icon name="alert" />{error}</div>}

      <section className="panel table-panel" aria-label="Hunters">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" aria-sort={c.sort && sort === c.sort ? (order === "asc" ? "ascending" : "descending") : undefined}>
                    {c.sort ? (
                      <button type="button" className="th-btn" onClick={() => sortBy(c.sort)}>
                        {c.label}{sort === c.sort ? <Icon name="chevronDown" className={`sm ${order === "asc" ? "flip" : ""}`} /> : null}
                      </button>
                    ) : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!data && Array.from({ length: 6 }, (_, i) => <tr key={i}><td colSpan={COLUMNS.length}><div className="skel" style={{ height: 40 }} /></td></tr>)}
              {data && data.items.length === 0 && <tr><td colSpan={COLUMNS.length}><div className="empty"><div className="display">No hunters match</div>Try a different search or clear the filters.</div></td></tr>}
              {data && data.items.map((u) => (
                <tr key={u.id} className={u.is_active ? "" : "is-disabled"} onClick={() => setOpenId(u.id)}>
                  <td>
                    <button type="button" className="who" onClick={(e) => { e.stopPropagation(); setOpenId(u.id); }}>
                      <span className="avatar sm">{u.name.slice(0, 1).toUpperCase()}</span>
                      <span><b>{u.name}</b><small>{u.email}</small></span>
                    </button>
                  </td>
                  <td>
                    <span className={`chip ${u.role === "admin" ? "cyan" : ""}`}>{u.role === "admin" ? "Admin" : "Hunter"}</span>
                    {!u.is_active && <span className="chip red">Disabled</span>}
                  </td>
                  <td>{u.stats ? <span className="rankcell"><b className="display">{u.stats.rank}</b> Lv {u.stats.level}</span> : <span className="faint">No plan yet</span>}</td>
                  <td className="num-cell">{u.stats ? <><Icon name="flame" className="sm" />{u.stats.current_streak}</> : "-"}</td>
                  <td>{u.stats ? <span className="pctcell"><span className="meter"><i style={{ width: `${u.stats.last7_completion}%` }} /></span>{u.stats.last7_completion}%<small className="faint"> 7d</small></span> : "-"}</td>
                  <td className="faint">{timeAgo(u.last_active_at)}</td>
                  <td className="faint">{timeAgo(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="pager">
            <span className="small muted">{data.total === 0 ? "0 hunters" : `${(data.page - 1) * data.page_size + 1} to ${Math.min(data.page * data.page_size, data.total)} of ${data.total}`}</span>
            <span className="row">
              <button type="button" className="icon-btn" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><Icon name="chevronLeft" /></button>
              <span className="small">Page {page} of {pages}</span>
              <button type="button" className="icon-btn" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><Icon name="chevronRight" /></button>
            </span>
          </div>
        )}
      </section>

      {openId !== null && <UserDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function Fact({ label, value }) {
  return <div className="fact"><dt>{label}</dt><dd>{value}</dd></div>;
}

function UserDrawer({ id, onClose, onChanged }) {
  const { user: me } = useAuth();
  const [u, setU] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [typed, setTyped] = useState("");
  const closeRef = useRef(null);

  const load = useCallback(() => api.adminUser(id).then(setU).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const act = async (fn) => {
    setBusy(true); setError("");
    try { await fn(); await load(); onChanged(); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const isMe = u && u.id === me.id;
  const s = u && u.stats;

  return (
    <div className="scrim side" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={u ? `${u.name}, hunter details` : "Hunter details"} onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div className="grow">
            {u ? (<><h2 className="display">{u.name}</h2><p className="muted small">{u.email}</p></>) : <div className="skel" style={{ height: 48, width: 220 }} />}
          </div>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>

        <div className="drawer-body">
          {error && <div className="alert error" role="alert"><Icon name="alert" />{error}</div>}
          {!u && !error && <div className="stack">{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 90 }} />)}</div>}
          {u && (
            <>
              <div className="row wrap">
                <span className={`chip ${u.role === "admin" ? "cyan" : ""}`}><Icon name={u.role === "admin" ? "shield" : "user"} />{u.role === "admin" ? "Admin" : "Hunter"}</span>
                <span className={`chip ${u.is_active ? "" : "red"}`}>{u.is_active ? "Active account" : "Disabled"}</span>
                {isMe && <span className="chip accent">This is you</span>}
              </div>

              {s ? (
                <section className="drawer-sec">
                  <div className="row" style={{ gap: 16 }}>
                    <RankEmblem rank={s.rank} size={72} />
                    <div><div className="display" style={{ fontSize: "1.75rem" }}>Level {s.level}</div><div className="small muted">{s.total_xp} XP, {s.perfect_days} perfect days</div></div>
                  </div>
                  <dl className="facts">
                    <Fact label="Current streak" value={s.current_streak} />
                    <Fact label="Best streak" value={s.longest_streak} />
                    <Fact label="Average completion" value={`${s.avg_completion}%`} />
                    <Fact label="Last 7 days" value={`${s.last7_completion}%`} />
                    <Fact label="Quests cleared" value={s.total_completed} />
                    <Fact label="Coins" value={u.coins} />
                  </dl>
                  <h3 className="subhead">Last 28 days</h3>
                  <div className="spark" role="img" aria-label="Daily completion for the last 28 days">
                    {u.recent_days.map((d) => <i key={d.date} title={`${d.date}: ${d.pct}%`} style={{ height: `${Math.max(6, d.pct)}%`, opacity: d.pct === 0 ? 0.25 : 1 }} />)}
                    {u.recent_days.length === 0 && <span className="faint small">No tracked days yet.</span>}
                  </div>
                  <p className="small faint">Plan: {u.plan_start} to {u.plan_end}. {s.quest_count} quests, {s.journal_entries} journal entries (private).</p>
                </section>
              ) : <p className="muted">This hunter hasn't set up a plan yet, so there's no progress to show.</p>}

              <section className="drawer-sec">
                <h3 className="subhead">Account</h3>
                <dl className="facts">
                  <Fact label="Joined" value={timeAgo(u.created_at)} />
                  <Fact label="Last sign-in" value={timeAgo(u.last_login_at)} />
                  <Fact label="Last active" value={timeAgo(u.last_active_at)} />
                </dl>
                <ul className="feed">
                  {u.history.map((a) => (
                    <li key={a.id}><span className={`chip ${auditTone(a.action)}`}>{auditLabel(a.action)}</span>
                      <span className="grow small faint">{a.detail}</span><span className="small faint">{timeAgo(a.at)}</span></li>
                  ))}
                </ul>
              </section>

              {!isMe ? (
                <section className="drawer-sec">
                  <h3 className="subhead">Actions</h3>
                  <div className="row wrap">
                    <button type="button" className="btn ghost sm" disabled={busy}
                      onClick={() => act(() => api.adminPatchUser(u.id, { role: u.role === "admin" ? "user" : "admin" }))}>
                      <Icon name="shield" className="sm" />{u.role === "admin" ? "Remove admin" : "Make admin"}
                    </button>
                    <button type="button" className="btn ghost sm" disabled={busy}
                      onClick={() => act(() => api.adminPatchUser(u.id, { is_active: !u.is_active }))}>
                      <Icon name="lock" className="sm" />{u.is_active ? "Disable account" : "Re-enable account"}
                    </button>
                    <button type="button" className="btn ghost sm" disabled={busy} onClick={() => act(() => api.adminForceLogout(u.id))}>
                      <Icon name="logout" className="sm" />Sign out everywhere
                    </button>
                  </div>
                  {u.role !== "admin" && (
                    !confirmDel ? (
                      <button type="button" className="btn danger sm" style={{ marginTop: 16 }} onClick={() => setConfirmDel(true)}><Icon name="trash" className="sm" />Delete account and data</button>
                    ) : (
                      <div className="danger-zone">
                        <p className="small">This permanently deletes the account and everything in it. Type <b>{u.email}</b> to confirm.</p>
                        <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type the email to confirm" />
                        <div className="row" style={{ marginTop: 10 }}>
                          <button type="button" className="btn danger sm" disabled={busy || typed.trim().toLowerCase() !== u.email}
                            onClick={async () => { setBusy(true); try { await api.adminDeleteUser(u.id); onChanged(); onClose(); } catch (e) { setError(e.message); setBusy(false); } }}>Delete forever</button>
                          <button type="button" className="btn ghost sm" onClick={() => { setConfirmDel(false); setTyped(""); }}>Cancel</button>
                        </div>
                      </div>
                    )
                  )}
                  {u.role === "admin" && <p className="help" style={{ marginTop: 12 }}>Remove admin rights before deleting this account.</p>}
                </section>
              ) : <p className="help">You can't change your own role or status here. Another admin can.</p>}

              <p className="privacy-foot"><Icon name="lock" className="sm" />Journal entries and quest names are private and never shown here. Viewing this profile was recorded in the audit log.</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
