import { useEffect, useState } from "react";
import Icon from "../icons";
import { Empty, ErrorNote } from "../ui";
import { auditLabel, auditTone } from "./auditLabels";
import { api } from "../../api";
import { timeAgo } from "../../dateUtils";

const FILTERS = [["", "Everything"], ["admin.", "🛡️ Admin actions"], ["content.", "🎛️ Content edits"], ["auth.", "🔑 Sign-ins"], ["user.", "👤 Account changes"]];

export default function AdminAudit() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    api.adminAudit({ action, page, page_size: 25 }).then(setData).catch((e) => setError(e.message));
  }, [action, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  return (
    <div className="stack">
      <section className="card sm row wrap">
        <div className="seg" role="tablist" aria-label="Filter the audit log">
          {FILTERS.map(([v, label]) => (
            <button key={label} type="button" role="tab" aria-selected={action === v} onClick={() => { setAction(v); setPage(1); }}>{label}</button>
          ))}
        </div>
        <p className="small muted grow">Newest first. Entries are append-only and survive account deletion.</p>
      </section>
      <ErrorNote error={error} />
      <section className="card" style={{ padding: 0, overflow: "hidden" }} aria-label="Audit log">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th scope="col">When</th><th scope="col">Event</th><th scope="col">Who did it</th><th scope="col">Who it was about</th><th scope="col">Detail</th></tr></thead>
            <tbody>
              {!data && Array.from({ length: 6 }, (_, i) => <tr key={i}><td colSpan={5}><div className="skel" style={{ height: 36 }} /></td></tr>)}
              {data && data.items.length === 0 && <tr><td colSpan={5}><Empty emoji="🧾" title="Nothing logged yet" /></td></tr>}
              {data && data.items.map((a) => (
                <tr key={a.id}>
                  <td className="faint" title={new Date(a.at).toLocaleString()}>{timeAgo(a.at)}</td>
                  <td><span className={`chip ${auditTone(a.action)}`}>{auditLabel(a.action)}</span></td>
                  <td>{a.actor_email || "System"}</td>
                  <td>{a.target_email || "-"}</td>
                  <td className="faint">{a.detail || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="pager">
            <span className="small muted">{data.total} events</span>
            <span className="row">
              <button type="button" className="icon-btn" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><Icon name="chevronLeft" /></button>
              <span className="small">Page {page} of {pages}</span>
              <button type="button" className="icon-btn" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><Icon name="chevronRight" /></button>
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
