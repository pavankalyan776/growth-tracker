import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { applyAccent } from "./theme";
import { useLook } from "./look";

/*
 * The member's live state. `overview` is the one object most screens read (level, coins, streak, boss, challenges).
 * Every write endpoint returns the fresh overview, and `commit(res)` applies it with no follow-up request.
 */
const GameContext = createContext(null);
export const useGame = () => useContext(GameContext);

const EVENT_COPY = {
  login: { title: "Daily login", emoji: "☀️" },
  perfect: { title: "Perfect day", emoji: "⭐" },
  monthly: { title: "Monthly achievement", emoji: "🏅" },
  milestone: { title: "Milestone unlocked", emoji: "🏆" },
  dare: { title: "Daily dare", emoji: "🎲" },
  boss: { title: "Weekly boss defeated", emoji: "⚔️" },
  challenge: { title: "Challenge complete", emoji: "🎯" },
};

export function GameProvider({ children }) {
  const [overview, setOverview] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [toasts, setToasts] = useState([]);
  const [queue, setQueue] = useState([]);
  const nextId = useRef(1);
  const { w } = useLook();
  const wRef = useRef(w);
  useEffect(() => { wRef.current = w; }, [w]);

  const celebrate = useCallback((c) => setQueue((q) => [...q, c]), []);

  const toast = useCallback((t) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { id, ...t }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), t.ms || 4200);
  }, []);

  const announce = useCallback((events) => {
    (events || []).forEach((e) => {
      const copy = EVENT_COPY[e.kind] || { title: "Reward", emoji: "🪙" };
      if (e.kind === "boss") {
        celebrate({ kind: "boss", emoji: e.emoji || "⚔️", kicker: wRef.current.bossDone, title: e.boss || wRef.current.boss, lines: [`🪙 +${e.amount} coins`, "✨ +50 XP"] });
        return;
      }
      if (e.kind === "challenge") {
        celebrate({ kind: "challenge", emoji: e.emoji || "🎯", kicker: "Challenge complete", title: e.challenge || "Your challenge", lines: [`🪙 +${e.amount} coins`, "✨ +30 XP"] });
        return;
      }
      toast({
        kind: "coin", emoji: copy.emoji, title: `+${e.amount} coins`,
        body: e.kind === "milestone" ? e.reason.replace("Milestone: ", "") : copy.title,
      });
    });
  }, [toast, celebrate]);

  const apply = useCallback((o) => {
    setOverview(o);
    applyAccent(o.theme);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const o = await api.getOverview();
      apply(o);
      setLoadError("");
      announce(o.events);
      return o;
    } catch (err) {
      setLoadError(err.message);
      return null;
    }
  }, [announce, apply]);

  /* Apply a write response: new overview, reward toasts. No second request. */
  const commit = useCallback((res) => {
    if (res && res.overview) apply(res.overview);
    if (res && res.events) announce(res.events);
    return res;
  }, [apply, announce]);

  useEffect(() => { refresh(); }, [refresh]);

  // Once the first screen is up, quietly warm the data for the pages people open next.
  useEffect(() => {
    const run = () => api.prefetch();
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 3000 });
      return () => window.cancelIdleCallback && window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 1500);
    return () => window.clearTimeout(id);
  }, []);

  const value = useMemo(() => ({
    overview, loadError, refresh, commit, announce, toast, celebrate,
  }), [overview, loadError, refresh, commit, announce, toast, celebrate]);

  return (
    <GameContext.Provider value={value}>
      {children}
      <ToastHost toasts={toasts} dismiss={(id) => setToasts((l) => l.filter((t) => t.id !== id))} />
      <Celebration data={queue[0] || null} onClose={() => setQueue((q) => q.slice(1))} />
    </GameContext.Provider>
  );
}

function ToastHost({ toasts, dismiss }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} type="button" className={`toast ${t.kind || ""}`} onClick={() => dismiss(t.id)}>
          <span className="toast-emoji emoji" aria-hidden="true">{t.emoji || "✨"}</span>
          <span className="toast-text">
            <b className="display">{t.title}</b>
            {t.body ? <span>{t.body}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37) % 100}%`, delay: `${((i * 53) % 90) / 100}s`, dur: `${2 + ((i * 17) % 12) / 10}s`,
}));

function Celebration({ data, onClose }) {
  useEffect(() => {
    if (!data) return undefined;
    const t = window.setTimeout(onClose, 4200);
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [data, onClose]);
  if (!data) return null;
  return (
    <div key={data.title + data.kicker} className="celebrate" role="dialog" aria-label={data.title} onClick={onClose}>
      <div className="confetti" aria-hidden="true">
        {CONFETTI.map((c, i) => <i key={i} style={{ left: c.left, animationDelay: c.delay, animationDuration: c.dur }} />)}
      </div>
      <div className="celebrate-copy">
        <span className="celebrate-emoji emoji" aria-hidden="true">{data.emoji || "🎉"}</span>
        <div className="celebrate-kicker">{data.kicker}</div>
        <div className="display celebrate-title">{data.title}</div>
        <div className="celebrate-lines">
          {data.lines.map((l) => <span key={l} className="chip accent">{l}</span>)}
        </div>
        <div className="celebrate-hint">Tap anywhere to continue</div>
      </div>
    </div>
  );
}
