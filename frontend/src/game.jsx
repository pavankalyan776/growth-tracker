import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { applyAccent } from "./theme";
import { useLook } from "./look";
import Icon from "./components/icons";

const GameContext = createContext(null);
export const useGame = () => useContext(GameContext);

const EVENT_COPY = {
  login: { title: "Daily login", icon: "coin" },
  perfect: { title: "Perfect day", icon: "star" },
  monthly: { title: "Monthly achievement", icon: "trophy" },
  milestone: { title: "Milestone unlocked", icon: "trophy" },
  dare: { title: "Daily dare", icon: "dice" },
  boss: { title: "Weekly boss defeated", icon: "swords" },
};

export function GameProvider({ children }) {
  const [overview, setOverview] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [toasts, setToasts] = useState([]);
  const [queue, setQueue] = useState([]);
  const nextId = useRef(1);
  const { w } = useLook();
  const celebrate = useCallback((c) => setQueue((q) => [...q, c]), []);

  const toast = useCallback((t) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-3), { id, ...t }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), t.ms || 4200);
  }, []);

  const announce = useCallback((events) => {
    (events || []).forEach((e) => {
      const copy = EVENT_COPY[e.kind] || { title: "Reward", icon: "coin" };
      if (e.kind === "boss") {
        celebrate({
          kind: "boss", kicker: w.bossDone, title: e.boss || w.boss,
          lines: [`+${e.amount} coins`, "+50 XP"],
        });
        return;
      }
      toast({
        kind: "coin", icon: copy.icon, title: `+${e.amount} coins`,
        body: e.kind === "milestone" ? e.reason.replace("Milestone: ", "") : copy.title,
      });
    });
  }, [toast, celebrate, w]);

  const refresh = useCallback(async () => {
    try {
      const o = await api.getOverview();
      setOverview(o);
      setLoadError("");
      applyAccent(o.theme);
      announce(o.events);
      return o;
    } catch (err) {
      setLoadError(err.message);
      return null;
    }
  }, [announce]);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({
    overview, loadError, refresh, announce, toast, celebrate,
  }), [overview, loadError, refresh, announce, toast, celebrate]);

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
          <Icon name={t.icon || "info"} />
          <span className="toast-text">
            <b className="display">{t.title}</b>
            {t.body ? <span>{t.body}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

function Celebration({ data, onClose }) {
  useEffect(() => {
    if (!data) return undefined;
    const t = window.setTimeout(onClose, 3600);
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [data, onClose]);
  if (!data) return null;
  return (
    <div key={data.title + data.kicker} className={`celebrate ${data.kind}`} role="dialog" aria-label={data.title} onClick={onClose}>
      <div className="burst" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="celebrate-copy">
        <div className="celebrate-kicker">{data.kicker}</div>
        <div className="display celebrate-title">{data.title}</div>
        <div className="celebrate-lines">
          {data.lines.map((l) => <span key={l} className="chip">{l}</span>)}
        </div>
        <div className="celebrate-hint">Tap anywhere to continue</div>
      </div>
    </div>
  );
}
