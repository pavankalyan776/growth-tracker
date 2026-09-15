import { useState, useEffect, useCallback } from "react";
import { api } from "./api";
import HunterCard from "./components/HunterCard";
import StatusView from "./components/StatusView";
import CalendarView from "./components/CalendarView";
import MilestonesView from "./components/MilestonesView";
import QuestManager from "./components/QuestManager";

const TABS = [
  { key: "status", label: "Status" },
  { key: "calendar", label: "Calendar" },
  { key: "milestones", label: "Milestones" },
  { key: "quests", label: "Quests" },
];

export default function App() {
  const [tab, setTab] = useState("status");
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "auto");

  const refreshStats = useCallback(() => {
    api.getStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { refreshStats(); }, [refreshStats]);

  useEffect(() => {
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  if (error) {
    return (
      <div className="wrap">
        <div className="error-box">
          Couldn't reach the API at the configured URL.<br />
          Make sure the FastAPI backend is running.<br />
          <small>{error}</small>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <HunterCard stats={stats} theme={theme} onThemeChange={setTheme} />

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "status" && <StatusView stats={stats} onDataChanged={refreshStats} />}
      {tab === "calendar" && <CalendarView onDataChanged={refreshStats} />}
      {tab === "milestones" && <MilestonesView />}
      {tab === "quests" && <QuestManager onDataChanged={refreshStats} />}
    </div>
  );
}
