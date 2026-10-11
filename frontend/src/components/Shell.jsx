import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "./Avatar";
import Icon from "./icons";
import RankEmblem from "./RankEmblem";
import { useAuth } from "../auth";
import { useGame } from "../game";
import { useLook } from "../look";

const trackerNav = (w) => [
  { key: "today", label: "Today", icon: "gate" },
  { key: "calendar", label: "Calendar", icon: "calendar" },
  { key: "progress", label: "Progress", icon: "chart" },
  { key: "hall", label: w.hall, icon: "podium" },
  { key: "quests", label: w.habits, icon: "list" },
  { key: "shop", label: w.rewards, icon: "bag" },
  { key: "achievements", label: w.milestones, icon: "trophy" },
];
const adminNav = (w) => [
  { key: "admin", label: "Overview", icon: "shield" },
  { key: "admin/users", label: w.members, icon: "users" },
  { key: "admin/audit", label: "Audit", icon: "log" },
];
const MOBILE_TABS = ["today", "calendar", "progress", "hall"];
const SIZES = ["standard", "large", "xl"];
const SIZE_LABEL = { standard: "Standard text", large: "Large text", xl: "Extra large text" };

function isActive(item, route) {
  const current = route.name === "admin" && route.param ? `admin/${route.param}` : route.name;
  return item.key === current;
}

export default function Shell({ route, title, subtitle, children, trackerReady }) {
  const { user, signOut } = useAuth();
  const game = useGame();
  const o = game ? game.overview : null;
  const look = useLook();
  const { w } = look;
  const mode = { dark: look.dark, toggle: look.toggleMode };
  const TRACKER_NAV = useMemo(() => trackerNav(w), [w]);
  const ADMIN_NAV = useMemo(() => adminNav(w), [w]);
  const nextSize = SIZES[(SIZES.indexOf(look.size) + 1) % SIZES.length];
  const nextStyle = look.style === "adventure" ? "calm" : "adventure";
  const [palette, setPalette] = useState(false);
  const [more, setMore] = useState(false);
  const isAdmin = user.role === "admin";
  const nav = trackerReady ? TRACKER_NAV : [];

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commands = useMemo(() => {
    const go = (key, label, icon) => ({ id: key, label, icon, run: () => route.navigate(key) });
    const list = [];
    if (trackerReady) {
      list.push(go("today", "Go to Today", "gate"), go("calendar", "Open the calendar", "calendar"),
        go("progress", "See your progress", "chart"), go("hall", `Open the ${w.hall.replace("The ", "")}`, "podium"),
        go("quests", `Edit your ${w.habitsLower}`, "list"),
        go("shop", `Open ${w.rewards}`, "bag"), go("achievements", `View ${w.milestones.toLowerCase()}`, "trophy"));
    }
    list.push(go("profile", "Profile and settings", "user"));
    if (isAdmin) list.push(go("admin", "Admin overview", "shield"), go("admin/users", `Admin: ${w.members.toLowerCase()}`, "users"), go("admin/audit", "Admin: audit log", "log"));
    list.push({ id: "mode", label: mode.dark ? "Switch to Day mode" : "Switch to Night mode", icon: mode.dark ? "sun" : "moon", run: mode.toggle });
    list.push({ id: "style", label: `Switch to ${nextStyle === "calm" ? "Calm (plain words)" : "Adventure (game words)"}`, icon: nextStyle === "calm" ? "leaf" : "swords", run: () => look.setStyle(nextStyle) });
    list.push({ id: "size", label: `Text size: ${SIZE_LABEL[nextSize].toLowerCase()}`, icon: "textsize", run: () => look.setSize(nextSize) });
    list.push({ id: "out", label: "Sign out", icon: "logout", run: () => signOut() });
    return list;
  }, [route, isAdmin, trackerReady, mode.dark, mode.toggle, signOut, w, look, nextStyle, nextSize, TRACKER_NAV, ADMIN_NAV]);

  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="rail" aria-label="Main navigation">
        <a className="rail-logo" href={trackerReady ? "#/today" : "#/admin"} aria-label="Growth Tracker home">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 28V14a11 11 0 0 1 22 0v14" /><path d="M11 28V17a5 5 0 0 1 10 0v11" /></svg>
        </a>
        <nav className="rail-nav">
          {nav.map((item) => (
            <a key={item.key} href={`#/${item.key}`} className={`rail-link${isActive(item, route) ? " is-active" : ""}`}
              aria-current={isActive(item, route) ? "page" : undefined}>
              <Icon name={item.icon} /><span>{item.label}</span>
            </a>
          ))}
          {isAdmin && (
            <>
              {nav.length > 0 && <hr className="rail-sep" />}
              {ADMIN_NAV.map((item) => (
                <a key={item.key} href={`#/${item.key}`} className={`rail-link admin${isActive(item, route) ? " is-active" : ""}`}
                  aria-current={isActive(item, route) ? "page" : undefined}>
                  <Icon name={item.icon} /><span>{item.label}</span>
                </a>
              ))}
            </>
          )}
        </nav>
        <a href="#/profile" className={`rail-link rail-me${route.name === "profile" ? " is-active" : ""}`} aria-label="Profile and settings">
          <Avatar name={user.name} avatar={user.avatar} size={38} /><span>Profile</span>
        </a>
      </aside>

      <div className="stage">
        <header className="topbar">
          <div className="topbar-title">
            <h1 className="display">{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="topbar-actions">
            <button type="button" className="cmd-trigger" onClick={() => setPalette(true)} aria-label="Open command palette">
              <Icon name="search" className="sm" /><span>Jump to</span><kbd>Ctrl K</kbd>
            </button>
            {o && (
              <>
                <span className="chip cyan hide-sm" title="Level"><Icon name="bolt" />Lv {o.level}</span>
                <span className={`chip streak${o.streak_at_risk ? " risk" : ""}`} title={o.streak_at_risk ? "Streak at risk: clear today" : "Current streak"}>
                  <Icon name="flame" />{o.current_streak}<span className="sr-only"> day streak</span>
                </span>
                <a className="chip gold" href="#/shop" title="Coins"><Icon name="coin" />{o.coins}<span className="sr-only"> coins</span></a>
              </>
            )}
            <button type="button" className="icon-btn hide-sm" onClick={() => look.setStyle(nextStyle)}
              aria-label={`Switch to ${nextStyle === "calm" ? "Calm, plain words" : "Adventure, game words"}`}
              title={`Switch to ${nextStyle === "calm" ? "Calm" : "Adventure"}`}>
              <Icon name={nextStyle === "calm" ? "leaf" : "swords"} />
            </button>
            <button type="button" className="icon-btn hide-sm" onClick={() => look.setSize(nextSize)}
              aria-label={`Text size. Switch to ${SIZE_LABEL[nextSize].toLowerCase()}`} title={SIZE_LABEL[nextSize]}>
              <Icon name="textsize" />
            </button>
            <button type="button" className="icon-btn hide-sm" onClick={mode.toggle}
              aria-label={mode.dark ? "Switch to Day mode" : "Switch to Night mode"}>
              <Icon name={mode.dark ? "sun" : "moon"} />
            </button>
          </div>
        </header>
        <main id="main" className="content" tabIndex={-1}>{children}</main>
      </div>

      <nav className="tabbar" aria-label="Main navigation">
        {trackerReady && TRACKER_NAV.filter((i) => MOBILE_TABS.includes(i.key)).map((item) => (
          <a key={item.key} href={`#/${item.key}`} className={`tab${isActive(item, route) ? " is-active" : ""}`}
            aria-current={isActive(item, route) ? "page" : undefined}>
            <Icon name={item.icon} /><span>{item.label}</span>
          </a>
        ))}
        {!trackerReady && isAdmin && ADMIN_NAV.map((item) => (
          <a key={item.key} href={`#/${item.key}`} className={`tab${isActive(item, route) ? " is-active" : ""}`}>
            <Icon name={item.icon} /><span>{item.label}</span>
          </a>
        ))}
        <button type="button" className={`tab${more ? " is-active" : ""}`} onClick={() => setMore(true)} aria-haspopup="dialog">
          <Icon name="menu" /><span>More</span>
        </button>
      </nav>

      {more && (
        <MoreSheet onClose={() => setMore(false)}>
          {trackerReady && TRACKER_NAV.filter((i) => !MOBILE_TABS.includes(i.key)).map((item) => (
            <a key={item.key} href={`#/${item.key}`} onClick={() => setMore(false)}><Icon name={item.icon} />{item.label}</a>
          ))}
          {isAdmin && ADMIN_NAV.map((item) => (
            <a key={item.key} href={`#/${item.key}`} onClick={() => setMore(false)}><Icon name={item.icon} />Admin: {item.label}</a>
          ))}
          <a href="#/profile" onClick={() => setMore(false)}><Icon name="user" />Profile and settings</a>
          <button type="button" onClick={() => { mode.toggle(); setMore(false); }}><Icon name={mode.dark ? "sun" : "moon"} />{mode.dark ? "Day mode" : "Night mode"}</button>
          <button type="button" onClick={() => { look.setStyle(nextStyle); setMore(false); }}><Icon name={nextStyle === "calm" ? "leaf" : "swords"} />{nextStyle === "calm" ? "Calm (plain words)" : "Adventure (game words)"}</button>
          <button type="button" onClick={() => look.setSize(nextSize)}><Icon name="textsize" />{SIZE_LABEL[nextSize]}</button>
          <button type="button" onClick={() => signOut()}><Icon name="logout" />Sign out</button>
        </MoreSheet>
      )}
      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}
    </div>
  );
}

function MoreSheet({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="More" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

function CommandPalette({ commands, onClose }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? commands.filter((c) => c.label.toLowerCase().includes(needle)) : commands;
  }, [q, commands]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setIdx(0); }, [q]);

  const run = (cmd) => { onClose(); if (cmd) cmd.run(); };
  const onKey = (e) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); run(results[idx]); }
  };

  return (
    <div className="scrim center" onClick={onClose}>
      <div className="palette panel sm" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="palette-input">
          <Icon name="search" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jump to a page or run a command"
            aria-label="Search commands" role="combobox" aria-expanded="true" aria-controls="palette-list"
            aria-activedescendant={results[idx] ? `cmd-${results[idx].id}` : undefined} />
        </div>
        <ul id="palette-list" role="listbox" className="palette-list">
          {results.length === 0 && <li className="palette-empty">Nothing matches "{q}".</li>}
          {results.map((c, i) => (
            <li key={c.id} id={`cmd-${c.id}`} role="option" aria-selected={i === idx}
              className={i === idx ? "is-sel" : ""} onMouseEnter={() => setIdx(i)} onClick={() => run(c)}>
              <Icon name={c.icon} />{c.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* A compact rank + XP strip, used at the top of the Today side panel on small screens. */
export function MiniHunter({ o }) {
  const { w } = useLook();
  return (
    <div className="mini-hunter">
      <RankEmblem rank={o.rank} size={44} />
      <div className="grow">
        <div className="row"><b className="display" style={{ fontSize: "1.25rem" }}>{o.hunter_name}</b><span className="faint small">{w.levelWord} {o.level}</span></div>
        <div className="xpbar"><i style={{ width: `${(o.xp_into_level / o.xp_per_level) * 100}%` }} /></div>
      </div>
    </div>
  );
}
