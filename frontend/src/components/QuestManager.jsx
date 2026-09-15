import { useState, useEffect, useCallback } from "react";
import { api } from "../api";

const STAT_KEYS = ["STR", "INT", "PER", "VIT", "AGI"];
const SECTIONS = [
  { key: "weekday", title: "Weekdays (Mon–Fri)" },
  { key: "saturday", title: "Saturday" },
  { key: "sunday", title: "Sunday" },
];

function QuestRow({ quest, onChange, onDelete }) {
  const [label, setLabel] = useState(quest.label);
  const [time, setTime] = useState(quest.time_label);
  const [stat, setStat] = useState(quest.stat);

  return (
    <div className="qrow">
      <input className="qlabel" type="text" value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label !== quest.label && onChange(quest.id, { label })} />
      <input className="qtime" type="text" value={time}
        onChange={(e) => setTime(e.target.value)}
        onBlur={() => time !== quest.time_label && onChange(quest.id, { time_label: time })} />
      <select className="qstat" value={stat}
        onChange={(e) => { setStat(e.target.value); onChange(quest.id, { stat: e.target.value }); }}>
        {STAT_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <button className="del" title="Delete" onClick={() => onDelete(quest.id, quest.label)}>✕</button>
    </div>
  );
}

export default function QuestManager({ onDataChanged }) {
  const [templates, setTemplates] = useState({ weekday: [], saturday: [], sunday: [] });

  const load = useCallback(() => {
    Promise.all(SECTIONS.map((s) => api.getQuests(s.key))).then(([weekday, saturday, sunday]) => {
      setTemplates({ weekday, saturday, sunday });
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (id, patch) => {
    await api.updateQuest(id, patch);
    onDataChanged();
  };

  const handleDelete = async (id, label) => {
    if (!confirm(`Delete "${label}"? Past completions for it will no longer be shown.`)) return;
    await api.deleteQuest(id);
    load();
    onDataChanged();
  };

  const handleAdd = async (dayType) => {
    await api.createQuest({ day_type: dayType, label: "New quest", time_label: "—", stat: "VIT" });
    load();
    onDataChanged();
  };

  return (
    <section>
      <div className="panel-head"><h2>Manage quests</h2></div>
      <div className="hint">Edit label, time, and the stat each quest trains. Changes apply to every day of that type, past and future.</div>

      {SECTIONS.map((sec) => (
        <div className="qsection" key={sec.key}>
          <h3>{sec.title}</h3>
          {templates[sec.key].map((q) => (
            <QuestRow key={q.id} quest={q} onChange={handleUpdate} onDelete={handleDelete} />
          ))}
          <div className="add-row">
            <button type="button" onClick={() => handleAdd(sec.key)}>+ Add quest</button>
          </div>
        </div>
      ))}
    </section>
  );
}
