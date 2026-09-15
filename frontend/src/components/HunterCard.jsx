import { useState, useEffect } from "react";
import { api } from "../api";

export default function HunterCard({ stats, theme, onThemeChange }) {
  const [name, setName] = useState("Player");

  useEffect(() => {
    api.getSetting("hunter_name").then((r) => setName(r.value)).catch(() => {});
  }, []);

  const saveName = () => {
    api.setSetting("hunter_name", name || "Player").catch(() => {});
  };

  const cycleTheme = () => {
    const next = theme === "auto" ? "dark" : theme === "dark" ? "light" : "auto";
    onThemeChange(next);
  };

  if (!stats) return null;
  const xpIntoLevel = stats.total_xp % 100;

  return (
    <div className="hunter-card">
      <div className="hunter-top">
        <div className="hunter-name-row">
          <div className="rank-badge">{stats.rank}</div>
          <input
            className="hunter-name-input"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            aria-label="Hunter name"
          />
        </div>
        <button className="theme-toggle" onClick={cycleTheme} type="button">
          {theme === "auto" ? "Auto" : theme === "dark" ? "Dark" : "Light"}
        </button>
      </div>
      <div className="xp-row">
        <div className="lvl-tag">LV <span className="hud-num">{stats.level}</span></div>
        <div className="xp-track"><div className="xp-fill" style={{ width: `${xpIntoLevel}%` }} /></div>
        <div className="xp-label">{xpIntoLevel}/100</div>
      </div>
      <div className="pill-row">
        <div className="pill coin">🪙 <span className="val">{stats.coins}</span></div>
        <div className="pill streak">🔥 <span className="val">{stats.current_streak}</span> day streak</div>
        <div className="pill">🏆 <span className="val">{stats.longest_streak}</span> best</div>
      </div>
    </div>
  );
}
