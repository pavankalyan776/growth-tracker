import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../icons";
import { Dialog, Empty, EmojiPicker, ErrorNote, Skeletons } from "../ui";
import { STAT_EMOJI } from "../../look";
import { api } from "../../api";

/*
 * Content studio: the low-code layer. An admin changes what members see (daily dares, starting plans,
 * announcements) with forms. Nothing here needs a deploy, and every change is written to the audit log.
 */
const TABS = [["dares", "🎲 Daily dares"], ["plans", "🌱 Starting plans"], ["announcements", "📣 Announcements"]];
const CATEGORIES = [["body", "Body 💪"], ["mind", "Mind 🧠"], ["kind", "Kindness 💌"], ["home", "Home 🏠"]];
const TONES = [["info", "📣 News"], ["tip", "💡 Tip"], ["party", "🎉 Celebration"]];
const DAY_TYPES = [["weekday", "Weekday"], ["saturday", "Saturday"], ["sunday", "Sunday"]];
const STATS = [["STR", "Strength"], ["INT", "Intellect"], ["PER", "Perception"], ["VIT", "Vitality"], ["AGI", "Agility"]];

export default function ContentStudio({ route }) {
  const tab = TABS.some(([k]) => k === route.second) ? route.second : "dares";
  const [note, setNote] = useState(null);
  const timer = useRef(0);
  const notify = useCallback((text, ok = true) => {
    setNote({ text, ok });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNote(null), 4500);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div className="stack">
      <section className="card tint">
        <h2 className="display" style={{ fontSize: "1.4rem" }}>🎛️ Change what members see, no code needed</h2>
        <p className="muted">Add a dare, publish an announcement, or build a starting plan with a form. Changes go live immediately and are recorded in the audit log.</p>
      </section>
      <nav className="subtabs" aria-label="Content type">
        {TABS.map(([k, label]) => <a key={k} href={`#/admin/studio/${k}`} aria-current={tab === k ? "page" : undefined}>{label}</a>)}
      </nav>
      {note && <div className={`alert ${note.ok ? "ok" : "error"}`} role="status"><Icon name={note.ok ? "check" : "alert"} />{note.text}</div>}
      {tab === "dares" && <DaresTab notify={notify} />}
      {tab === "plans" && <PlansTab notify={notify} />}
      {tab === "announcements" && <AnnouncementsTab notify={notify} />}
    </div>
  );
}

/* ---------------------------------------------------------------- dares */

function DaresTab({ notify }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [showBuiltin, setShowBuiltin] = useState(false);
  const load = useCallback(() => api.adminDares().then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const save = async (form, id) => {
    if (id) await api.adminEditDare(id, form); else await api.adminAddDare(form);
    notify(id ? "Dare saved." : "Dare added. Members can get it from tomorrow on.");
    setEditing(null);
    load();
  };
  const toggle = async (d) => {
    try { await api.adminEditDare(d.id, { active: !d.active }); notify(d.active ? "Dare hidden." : "Dare is live again."); load(); }
    catch (e) { notify(e.message, false); }
  };
  const remove = async (d) => {
    try { await api.adminDeleteDare(d.id); notify("Dare deleted."); load(); }
    catch (e) { notify(`${e.message} Hide it instead.`, false); }
  };

  if (error && !data) return <ErrorNote error={error} />;
  if (!data) return <Skeletons n={3} h={90} />;
  return (
    <>
      <section className="card">
        <div className="card-head">
          <h3 className="card-title">Your dares</h3>
          <span className="card-sub">{data.custom.filter((d) => d.active).length} live</span>
          <button type="button" className="btn sm" onClick={() => setEditing("new")}>➕ New dare</button>
        </div>
        <p className="small muted" style={{ marginBottom: 12 }}>Each member gets one dare a day, picked from the {data.builtin.length} built-in dares plus your live ones. A new dare never changes a dare someone already has for today.</p>
        {data.custom.length === 0 ? <Empty emoji="🎲" title="No custom dares yet">Add one, like "Text someone you miss".</Empty> : (
          <div className="studio-grid">
            {data.custom.map((d) => (
              <article key={d.id} className={`studio-item${d.active ? "" : " is-off"}`}>
                <span className="big-emoji emoji" aria-hidden="true">{d.emoji}</span>
                <div className="grow">
                  <b>{d.label}</b>
                  {d.hint ? <span className="small muted">{d.hint}</span> : null}
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    <span className="chip">{CATEGORIES.find(([k]) => k === d.category)?.[1]}</span>
                    {!d.active && <span className="chip danger">Hidden</span>}
                  </div>
                  <div className="acts">
                    <button type="button" className="btn ghost sm" onClick={() => setEditing(d)}>✏️ Edit</button>
                    <button type="button" className="btn ghost sm" onClick={() => toggle(d)}>{d.active ? "🙈 Hide" : "👁️ Show"}</button>
                    <button type="button" className="btn ghost sm" onClick={() => remove(d)} aria-label={`Delete ${d.label}`}>🗑️</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="card">
        <div className="card-head"><h3 className="card-title">Built-in dares</h3>
          <button type="button" className="link-btn card-sub" onClick={() => setShowBuiltin(!showBuiltin)}>{showBuiltin ? "Hide" : `Show all ${data.builtin.length}`}</button></div>
        {showBuiltin ? (
          <div className="studio-grid">
            {data.builtin.map((d) => (
              <article key={d.key} className="studio-item"><span className="big-emoji emoji" aria-hidden="true">{d.emoji}</span><div><b>{d.label}</b><span className="small muted">{d.hint}</span></div></article>
            ))}
          </div>
        ) : <p className="small muted">These ship with the app and can't be edited. Add your own above to mix with them.</p>}
      </section>
      {editing && <DareForm dare={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}

function DareForm({ dare, onClose, onSave }) {
  const [f, setF] = useState({ label: dare?.label || "", hint: dare?.hint || "", category: dare?.category || "mind", emoji: dare?.emoji || "✨", active: dare ? dare.active : true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await onSave({ ...f, label: f.label.trim(), hint: f.hint.trim() }, dare?.id); } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <Dialog title={dare ? "Edit dare" : "New dare"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field"><label htmlFor="d-label">The dare (5 to 120 characters)</label>
          <input id="d-label" className="input" value={f.label} maxLength={120} onChange={(e) => set("label", e.target.value)} placeholder="Text someone you haven't spoken to in a while" /></div>
        <div className="field"><label htmlFor="d-hint">A little hint (optional)</label>
          <input id="d-hint" className="input" value={f.hint} maxLength={160} onChange={(e) => set("hint", e.target.value)} placeholder="Even a single line counts." /></div>
        <div className="field"><label htmlFor="d-cat">Category</label>
          <select id="d-cat" className="select" value={f.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <EmojiPicker value={f.emoji} onChange={(v) => set("emoji", v)} set="dare" />
        <label className="row" style={{ marginBottom: 12 }}><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Live (members can get this dare)</label>
        <div className="preview-box"><b><span className="emoji">{f.emoji}</span> {f.label || "Your dare"}</b><div className="small muted">{f.hint || "Hint appears here."}</div></div>
        {error && <div className="alert error" role="alert"><Icon name="alert" />{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={busy || f.label.trim().length < 5}>{busy ? "Saving…" : "Save dare"}</button>
        </div>
      </form>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- announcements */

function AnnouncementsTab({ notify }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => api.adminAnnouncements().then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const save = async (form, id) => {
    if (id) await api.adminEditAnnouncement(id, form); else await api.adminAddAnnouncement(form);
    notify(id ? "Announcement saved." : "Announcement published. Members see it on their Today page.");
    setEditing(null);
    load();
  };
  const toggle = async (a) => {
    try { await api.adminEditAnnouncement(a.id, { active: !a.active }); notify(a.active ? "Announcement hidden." : "Announcement is live."); load(); }
    catch (e) { notify(e.message, false); }
  };
  const remove = async (a) => {
    try { await api.adminDeleteAnnouncement(a.id); notify("Announcement deleted."); load(); } catch (e) { notify(e.message, false); }
  };

  if (error && !items) return <ErrorNote error={error} />;
  if (!items) return <Skeletons n={3} h={90} />;
  return (
    <>
      <section className="card">
        <div className="card-head"><h3 className="card-title">Announcements</h3>
          <button type="button" className="btn sm" onClick={() => setEditing("new")}>➕ New announcement</button></div>
        <p className="small muted" style={{ marginBottom: 12 }}>A banner at the top of every member's Today page. Members can dismiss it. The two newest live ones are shown.</p>
        {items.length === 0 ? <Empty emoji="📣" title="Nothing published yet">Share a tip or celebrate a milestone.</Empty> : (
          <div className="studio-grid">
            {items.map((a) => (
              <article key={a.id} className={`studio-item${a.active ? "" : " is-off"}`}>
                <span className="big-emoji emoji" aria-hidden="true">{a.emoji}</span>
                <div className="grow">
                  <b>{a.title}</b>
                  {a.body ? <span className="small muted">{a.body}</span> : null}
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    <span className="chip">{TONES.find(([k]) => k === a.tone)?.[1]}</span>
                    {a.expires_on && <span className="chip">Until {a.expires_on}</span>}
                    {!a.active && <span className="chip danger">Hidden</span>}
                  </div>
                  <div className="acts">
                    <button type="button" className="btn ghost sm" onClick={() => setEditing(a)}>✏️ Edit</button>
                    <button type="button" className="btn ghost sm" onClick={() => toggle(a)}>{a.active ? "🙈 Hide" : "👁️ Show"}</button>
                    <button type="button" className="btn ghost sm" onClick={() => remove(a)} aria-label={`Delete ${a.title}`}>🗑️</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {editing && <AnnouncementForm item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}

function AnnouncementForm({ item, onClose, onSave }) {
  const [f, setF] = useState({ title: item?.title || "", body: item?.body || "", emoji: item?.emoji || "📣", tone: item?.tone || "info", active: item ? item.active : true, expires_on: item?.expires_on || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    const body = { title: f.title.trim(), body: f.body.trim(), emoji: f.emoji, tone: f.tone, active: f.active };
    if (f.expires_on) body.expires_on = f.expires_on; else if (item?.expires_on) body.clear_expiry = true;
    try { await onSave(body, item?.id); } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <Dialog title={item ? "Edit announcement" : "New announcement"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field"><label htmlFor="a-title">Headline (up to 80 characters)</label>
          <input id="a-title" className="input" value={f.title} maxLength={80} onChange={(e) => set("title", e.target.value)} placeholder="New: build your own challenges!" /></div>
        <div className="field"><label htmlFor="a-body">Message (optional, up to 300)</label>
          <textarea id="a-body" className="textarea" value={f.body} maxLength={300} onChange={(e) => set("body", e.target.value)} placeholder="Open Challenges and tap Build a challenge." /></div>
        <EmojiPicker value={f.emoji} onChange={(v) => set("emoji", v)} set="announce" />
        <div className="field"><span className="label" id="a-tone">Style</span>
          <div className="seg" role="radiogroup" aria-labelledby="a-tone">{TONES.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={f.tone === k} onClick={() => set("tone", k)}>{l}</button>)}</div></div>
        <div className="field"><label htmlFor="a-exp">Hide automatically after (optional)</label>
          <input id="a-exp" type="date" className="input" value={f.expires_on} onChange={(e) => set("expires_on", e.target.value)} /></div>
        <label className="row" style={{ marginBottom: 12 }}><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Live</label>
        <aside className={`banner tone-${f.tone}`} style={{ marginBottom: 14 }}>
          <span className="banner-emoji emoji" aria-hidden="true">{f.emoji}</span>
          <div><b>{f.title || "Your headline"}</b>{f.body ? <p>{f.body}</p> : null}</div>
        </aside>
        {error && <div className="alert error" role="alert"><Icon name="alert" />{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={busy || f.title.trim().length < 2}>{busy ? "Saving…" : item ? "Save" : "Publish"}</button>
        </div>
      </form>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- starting plans */

function PlansTab({ notify }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => api.adminTemplates().then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const save = async (form, key) => {
    if (key) await api.adminEditTemplate(key, form); else await api.adminAddTemplate(form);
    notify(key ? "Starting plan saved." : "Starting plan added. New members can pick it.");
    setEditing(null);
    load();
  };
  const toggle = async (t) => {
    try { await api.adminEditTemplate(t.key, { active: !t.active }); notify(t.active ? "Plan hidden from new members." : "Plan is live."); load(); }
    catch (e) { notify(e.message, false); }
  };
  const remove = async (t) => {
    try { await api.adminDeleteTemplate(t.key); notify("Plan deleted."); load(); } catch (e) { notify(e.message, false); }
  };

  if (error && !items) return <ErrorNote error={error} />;
  if (!items) return <Skeletons n={3} h={90} />;
  return (
    <>
      <section className="card">
        <div className="card-head"><h3 className="card-title">Starting plans</h3>
          <button type="button" className="btn sm" onClick={() => setEditing("new")}>➕ New plan</button></div>
        <p className="small muted" style={{ marginBottom: 12 }}>The choices new members see in setup. Editing a plan never changes tasks someone already has. Built-in plans can be edited or hidden, not deleted.</p>
        <div className="studio-grid">
          {items.map((t) => (
            <article key={t.key} className={`studio-item${t.active ? "" : " is-off"}`}>
              <span className="big-emoji emoji" aria-hidden="true">{t.emoji}</span>
              <div className="grow">
                <b>{t.label}</b>
                <span className="small muted">{t.desc}</span>
                <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                  <span className="chip">{t.quests} tasks</span>
                  {t.builtin && <span className="chip info">Built in</span>}
                  {!t.active && <span className="chip danger">Hidden</span>}
                </div>
                <div className="acts">
                  <button type="button" className="btn ghost sm" onClick={() => setEditing(t)}>✏️ Edit</button>
                  <button type="button" className="btn ghost sm" onClick={() => toggle(t)}>{t.active ? "🙈 Hide" : "👁️ Show"}</button>
                  {!t.builtin && <button type="button" className="btn ghost sm" onClick={() => remove(t)} aria-label={`Delete ${t.label}`}>🗑️</button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      {editing && <PlanForm plan={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}

function PlanForm({ plan, onClose, onSave }) {
  const [f, setF] = useState({
    key: plan?.key || "", label: plan?.label || "", desc: plan?.desc || "", emoji: plan?.emoji || "🌱", active: plan ? plan.active : true,
    quests: plan?.quest_list ? plan.quest_list.map((q) => ({ ...q })) : [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setQ = (i, k, v) => setF((x) => ({ ...x, quests: x.quests.map((q, j) => (j === i ? { ...q, [k]: v } : q)) }));
  const addQ = () => setF((x) => ({ ...x, quests: [...x.quests, { day_type: "weekday", label: "", time_label: "All day", stat: "VIT" }] }));
  const delQ = (i) => setF((x) => ({ ...x, quests: x.quests.filter((_, j) => j !== i) }));
  const keyOk = plan || /^[a-z][a-z0-9_]{1,29}$/.test(f.key);
  const questsOk = f.quests.every((q) => q.label.trim());

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    const quests = f.quests.map((q) => ({ ...q, label: q.label.trim(), time_label: q.time_label.trim() || "All day" }));
    const body = { label: f.label.trim(), desc: f.desc.trim(), emoji: f.emoji, active: f.active, quests };
    if (!plan) body.key = f.key;
    try { await onSave(body, plan?.key); } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <Dialog title={plan ? `Edit ${plan.label}` : "New starting plan"} onClose={onClose} wide>
      <form onSubmit={submit}>
        {!plan && (
          <div className="field"><label htmlFor="p-key">Short id (lowercase letters, digits, underscores)</label>
            <input id="p-key" className="input" value={f.key} maxLength={30} onChange={(e) => set("key", e.target.value.toLowerCase())} placeholder="morning_routine" /></div>
        )}
        <div className="grid-2">
          <div className="field"><label htmlFor="p-label">Name</label>
            <input id="p-label" className="input" value={f.label} maxLength={60} onChange={(e) => set("label", e.target.value)} placeholder="Morning routine" /></div>
          <div className="field"><label htmlFor="p-desc">One-line description</label>
            <input id="p-desc" className="input" value={f.desc} maxLength={200} onChange={(e) => set("desc", e.target.value)} placeholder="Start the day well." /></div>
        </div>
        <EmojiPicker value={f.emoji} onChange={(v) => set("emoji", v)} set="plan" />
        <div className="field">
          <span className="label">Tasks ({f.quests.length})</span>
          {f.quests.length === 0 && <p className="small muted">No tasks yet. A plan with no tasks starts members with a blank slate.</p>}
          {f.quests.map((q, i) => (
            <div className="quest-edit" key={i}>
              <select className="select" aria-label="Day type" value={q.day_type} onChange={(e) => setQ(i, "day_type", e.target.value)}>{DAY_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input className="input qe-label" aria-label="Task" value={q.label} maxLength={200} onChange={(e) => setQ(i, "label", e.target.value)} placeholder="Stretch for 10 minutes" />
              <input className="input" aria-label="Time block" value={q.time_label} maxLength={50} onChange={(e) => setQ(i, "time_label", e.target.value)} placeholder="7:00 – 7:10 AM" />
              <select className="select" aria-label="Trains" value={q.stat} onChange={(e) => setQ(i, "stat", e.target.value)}>{STATS.map(([k, l]) => <option key={k} value={k}>{STAT_EMOJI[k]} {l}</option>)}</select>
              <button type="button" className="icon-btn" onClick={() => delQ(i)} aria-label="Remove task"><Icon name="trash" /></button>
            </div>
          ))}
          <div><button type="button" className="btn ghost sm" onClick={addQ} disabled={f.quests.length >= 60}>➕ Add task</button></div>
        </div>
        <label className="row" style={{ marginBottom: 12 }}><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Live (new members can choose this plan)</label>
        {error && <div className="alert error" role="alert"><Icon name="alert" />{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={busy || f.label.trim().length < 2 || !keyOk || !questsOk}>{busy ? "Saving…" : "Save plan"}</button>
        </div>
      </form>
    </Dialog>
  );
}
