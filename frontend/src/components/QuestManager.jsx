import { useCallback, useEffect, useState } from "react";
import Icon from "./icons";
import { STAT_COLOR } from "./charts";
import { api } from "../api";
import { useGame } from "../game";
import { useLook, useStatNames } from "../look";

const STAT_KEYS = ["STR", "INT", "PER", "VIT", "AGI"];
const SECTIONS = [
  { key: "weekday", title: "Weekdays", hint: "Monday to Friday" },
  { key: "saturday", title: "Saturday", hint: "Deep focus and a mock test" },
  { key: "sunday", title: "Sunday", hint: "Review and rest" },
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function QuestRow({ quest, onChange, onDelete }) {
  const { w } = useLook();
  const { name: STAT_NAME } = useStatNames();
  const [label, setLabel] = useState(quest.label);
  const [time, setTime] = useState(quest.time_label);
  const [confirm, setConfirm] = useState(false);
  const commit = (patch) => onChange(quest.id, patch);
  return (
    <li className="qrow">
      <span className="qrow-stat" style={{ background: STAT_COLOR[quest.stat] }} aria-hidden="true" />
      <div className="field qf-label"><label htmlFor={`l-${quest.id}`}>{cap(w.habit)}</label>
        <input id={`l-${quest.id}`} className="input" value={label} maxLength={200} onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label.trim() && label !== quest.label && commit({ label: label.trim() })} /></div>
      <div className="field qf-time"><label htmlFor={`t-${quest.id}`}>Time block</label>
        <input id={`t-${quest.id}`} className="input" value={time} maxLength={50} onChange={(e) => setTime(e.target.value)}
          onBlur={() => time.trim() && time !== quest.time_label && commit({ time_label: time.trim() })} /></div>
      <div className="field qf-stat"><label htmlFor={`s-${quest.id}`}>Trains</label>
        <select id={`s-${quest.id}`} className="select" value={quest.stat} onChange={(e) => commit({ stat: e.target.value })}>
          {STAT_KEYS.map((k) => <option key={k} value={k}>{STAT_NAME[k]}</option>)}
        </select></div>
      <div className="qf-del">
        {confirm ? (
          <span className="row">
            <button type="button" className="btn danger sm" onClick={() => onDelete(quest.id)}>Delete</button>
            <button type="button" className="btn ghost sm" onClick={() => setConfirm(false)}>Keep</button>
          </span>
        ) : (
          <button type="button" className="icon-btn" onClick={() => setConfirm(true)} aria-label={`Delete ${quest.label}`}><Icon name="trash" /></button>
        )}
      </div>
    </li>
  );
}

export default function QuestManager() {
  const { refresh, toast } = useGame();
  const { w } = useLook();
  const { name: STAT_NAME } = useStatNames();
  const [tab, setTab] = useState("weekday");
  const [all, setAll] = useState(null);
  const [draft, setDraft] = useState({ label: "", time_label: "", stat: "VIT" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.getQuests().then(setAll).catch((e) => toast({ icon: "alert", title: `Couldn't load ${w.habitsLower}`, body: e.message })), [toast, w.habitsLower]);
  useEffect(() => { load(); }, [load]);

  const change = async (id, patch) => {
    try { await api.updateQuest(id, patch); await load(); await refresh(); }
    catch (e) { toast({ icon: "alert", title: "Couldn't save", body: e.message }); load(); }
  };
  const remove = async (id) => {
    try { await api.deleteQuest(id); await load(); await refresh(); toast({ icon: "trash", title: `${cap(w.habit)} deleted` }); }
    catch (e) { toast({ icon: "alert", title: "Couldn't delete", body: e.message }); }
  };
  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createQuest({ day_type: tab, label: draft.label.trim(), time_label: draft.time_label.trim() || "All day", stat: draft.stat });
      setDraft({ label: "", time_label: "", stat: draft.stat });
      await load(); await refresh();
      toast({ icon: "check", title: `${cap(w.habit)} added` });
    } catch (err) { toast({ icon: "alert", title: `Couldn't add ${w.habit}`, body: err.message }); }
    setBusy(false);
  };

  const section = SECTIONS.find((s) => s.key === tab);
  const rows = all ? all.filter((q) => q.day_type === tab) : null;

  return (
    <div className="stack">
      <section className="panel sm row wrap">
        <div className="seg" role="tablist" aria-label="Day type">
          {SECTIONS.map((s) => (
            <button key={s.key} type="button" role="tab" aria-selected={tab === s.key} onClick={() => setTab(s.key)}>
              {s.title}{all ? ` (${all.filter((q) => q.day_type === s.key).length})` : ""}
            </button>
          ))}
        </div>
        <p className="small muted grow">{`Edits apply to every ${section.title.toLowerCase().replace("weekdays", "weekday")}, past and future. Deleting a ${w.habit} also removes its history.`}</p>
      </section>

      <section className="panel">
        <div className="panel-head"><h3 className="panel-title">{section.title}</h3><span className="panel-sub">{section.hint}</span></div>
        {!rows ? <div className="stack">{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 64 }} />)}</div>
          : rows.length === 0 ? <div className="empty"><div className="display">{`No ${w.habitsLower} yet`}</div>{`Add your first ${section.title.toLowerCase()} ${w.habit} below.`}</div>
          : <ul className="qlist">{rows.map((q) => <QuestRow key={`${q.id}-${q.label}-${q.time_label}`} quest={q} onChange={change} onDelete={remove} />)}</ul>}
      </section>

      <form className="panel sm qadd" onSubmit={add}>
        <div className="field qf-label"><label htmlFor="nq-label">{`New ${w.habit}`}</label>
          <input id="nq-label" className="input" value={draft.label} maxLength={200} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Read 20 pages" /></div>
        <div className="field qf-time"><label htmlFor="nq-time">Time block</label>
          <input id="nq-time" className="input" value={draft.time_label} maxLength={50} onChange={(e) => setDraft({ ...draft, time_label: e.target.value })} placeholder="9:30 – 10:00 PM" /></div>
        <div className="field qf-stat"><label htmlFor="nq-stat">Trains</label>
          <select id="nq-stat" className="select" value={draft.stat} onChange={(e) => setDraft({ ...draft, stat: e.target.value })}>
            {STAT_KEYS.map((k) => <option key={k} value={k}>{STAT_NAME[k]}</option>)}
          </select></div>
        <div className="qf-del"><button type="submit" className="btn" disabled={busy || !draft.label.trim()}><Icon name="plus" className="sm" />{`Add ${w.habit}`}</button></div>
      </form>
    </div>
  );
}
