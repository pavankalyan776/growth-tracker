import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import Appearance, { AppearanceButton } from "./Appearance";
import Icon from "./icons";
import { useAuth } from "../auth";
import { useGame } from "../game";
import { useLook } from "../look";

/* Six places, grouped. A group with two pages (Plan, Challenges, Rewards) shows its pages as tabs under the title. */
export const GROUPS = [
  { key: "today", to: "today", emoji: "🏠", label: "Today", pages: ["today"] },
  { key: "plan", to: "calendar", emoji: "🗓️", label: "Plan", pages: ["calendar", "quests"] },
  { key: "challenges", to: "challenges", emoji: "🎯", label: "Challenges", pages: ["challenges", "hall"] },
  { key: "progress", to: "progress", emoji: "📈", label: "Progress", pages: ["progress"] },
  { key: "rewards", to: "shop", emoji: "🎁", label: "Rewards", pages: ["shop", "achievements"] },
  { key: "profile", to: "profile", emoji: "👤", label: "Profile", pages: ["profile"] },
];
const MOBILE = ["today", "plan", "challenges", "progress"];

export const groupOf = (name) => GROUPS.find((g) => g.pages.includes(name));

export function tabsFor(group, w) {
  if (group.key === "plan") return [["calendar", "📅 Calendar"], ["quests", `🗓️ ${w.myHabits}`]];
  if (group.key === "challenges") return [["challenges", "🎯 Challenges"], ["hall", `🏆 ${w.hall}`]];
  if (group.key === "rewards") return [["shop", "🛍️ Shop"], ["achievements", `🏅 ${w.milestones}`]];
  return null;
}

export default function AppShell({ route, title, subtitle, children, trackerReady }) {
  const { user, signOut } = useAuth();
  const game = useGame();
  const o = game ? game.overview : null;
  const { w } = useLook();
  const [more, setMore] = useState(false);
  const [look, setLook] = useState(false);
  const isAdmin = user.role === "admin";
  const group = groupOf(route.name);
  const tabs = group ? tabsFor(group, w) : null;
  const nav = trackerReady ? GROUPS : GROUPS.filter((g) => g.key === "profile");

  useEffect(() => { setMore(false); }, [route.name]);
  useEffect(() => { document.title = title ? `${title} · Growth Tracker` : "Growth Tracker"; }, [title]);

  const label = (g) => (g.key === "plan" ? "Plan" : g.label);

  return (
    <div className="app">
      <aside className="side" aria-label="Sidebar">
        <a className="brand" href="#/today"><span className="brand-mark emoji" aria-hidden="true">🌅</span><span className="brand-name">Growth<br />Tracker</span></a>
        <nav className="side-nav" aria-label="Main">
          {nav.map((g) => (
            <a key={g.key} href={`#/${g.to}`} className="nav-item" aria-current={g.pages.includes(route.name) ? "page" : undefined}>
              <span className="nav-emoji emoji" aria-hidden="true">{g.emoji}</span>
              <span className="nav-label">{label(g)}</span>
            </a>
          ))}
        </nav>
        <div className="side-foot">
          {isAdmin && <a className="btn soft sm" href="#/admin"><span className="emoji" aria-hidden="true">🛡️</span> Admin console</a>}
          {o && (
            <a className="me-card" href="#/profile">
              <Avatar name={o.hunter_name} avatar={o.avatar} size={40} />
              <div><b>{o.hunter_name}</b><span>{o.title_emoji} {w.levelWord} {o.level}</span></div>
            </a>
          )}
          <AppearanceButton up className="btn ghost sm" />
          <button type="button" className="btn ghost sm" onClick={() => signOut()}><Icon name="logout" className="sm" />Sign out</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="grow">
            <h1 className="page-title">{title}</h1>
            {subtitle ? <p className="page-sub">{subtitle}</p> : null}
          </div>
          <div className="top-actions">
            {o && (
              <>
                <span className="stat-pill" title="Current streak"><span className="emoji" aria-hidden="true">🔥</span><span className="num">{o.current_streak}</span><span className="sr-only"> day streak</span></span>
                <span className="stat-pill" title="Coins"><span className="emoji" aria-hidden="true">🪙</span><span className="num">{o.coins}</span><span className="sr-only"> coins</span></span>
              </>
            )}
          </div>
        </header>
        <main className="page" id="main">
          {tabs ? (
            <nav className="subtabs page-tabs" aria-label={`${group.label} pages`}>
              {tabs.map(([key, text]) => <a key={key} href={`#/${key}`} aria-current={route.name === key ? "page" : undefined}>{text}</a>)}
            </nav>
          ) : null}
          {children}
        </main>
      </div>

      <nav className="tabbar" aria-label="Tabs">
        {GROUPS.filter((g) => MOBILE.includes(g.key)).filter(() => trackerReady).map((g) => (
          <a key={g.key} href={`#/${g.to}`} className="tab-item" aria-current={g.pages.includes(route.name) ? "page" : undefined}>
            <span className="tab-emoji emoji" aria-hidden="true">{g.emoji}</span>{g.label}
          </a>
        ))}
        {!trackerReady && <a href="#/profile" className="tab-item" aria-current="page"><span className="tab-emoji emoji" aria-hidden="true">👤</span>Profile</a>}
        <button type="button" className="tab-item" aria-expanded={more} onClick={() => setMore(!more)}>
          <span className="tab-emoji emoji" aria-hidden="true">✨</span>More
        </button>
      </nav>

      {more && (
        <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setMore(false); }}>
          <div className="dialog more-sheet" role="dialog" aria-label="More">
            <div className="stack">
              {trackerReady && (
                <>
                  <a className="btn ghost" href="#/shop"><span className="emoji" aria-hidden="true">🎁</span> Rewards</a>
                  <a className="btn ghost" href="#/profile"><span className="emoji" aria-hidden="true">👤</span> Profile</a>
                </>
              )}
              <button type="button" className="btn ghost" aria-expanded={look} onClick={() => setLook(!look)}><span className="emoji" aria-hidden="true">🎨</span> Look</button>
              {look && <Appearance />}
              {isAdmin && <a className="btn soft" href="#/admin"><span className="emoji" aria-hidden="true">🛡️</span> Admin console</a>}
              <button type="button" className="btn ghost" onClick={() => signOut()}><Icon name="logout" className="sm" />Sign out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
