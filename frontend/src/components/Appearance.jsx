import { useEffect, useRef, useState } from "react";
import { useLook } from "../look";

const STYLES = [
  { key: "adventure", emoji: "⚔️", title: "Adventure", body: "Quests, ranks and bosses." },
  { key: "calm", emoji: "🌱", title: "Calm", body: "Habits, tiers and goals." },
];
const MODES = [["light", "☀️ Day"], ["dark", "🌙 Night"], ["system", "💻 Auto"]];
const SIZES = [["standard", "Aa"], ["large", "Aa+"], ["xl", "Aa++"]];
const SIZE_LABEL = { standard: "Standard", large: "Large", xl: "Extra large" };

/* Words, brightness and text size. Used inside the popover, the Profile page and setup. */
export default function Appearance() {
  const look = useLook();
  return (
    <div className="appearance">
      <div className="field">
        <span className="label" id="look-style">Words</span>
        <div className="choices two" role="radiogroup" aria-labelledby="look-style">
          {STYLES.map((s) => (
            <button key={s.key} type="button" role="radio" aria-checked={look.style === s.key} className="choice" onClick={() => look.setStyle(s.key)}>
              <span className="choice-emoji emoji" aria-hidden="true">{s.emoji}</span>
              <b className="display">{s.title}</b>
              <span>{s.body}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="label" id="look-mode">Brightness</span>
        <div className="seg" role="radiogroup" aria-labelledby="look-mode">
          {MODES.map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={look.modePref === v} onClick={() => look.setMode(v)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="label" id="look-size">Text size</span>
        <div className="seg" role="radiogroup" aria-labelledby="look-size">
          {SIZES.map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={look.size === v} aria-label={SIZE_LABEL[v]} onClick={() => look.setSize(v)}>{label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppearanceButton({ up = false, className = "stat-pill" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="pop-wrap" ref={ref}>
      <button type="button" className={className} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog">
        <span className="emoji" aria-hidden="true">🎨</span> Look
      </button>
      {open && (
        <div className={`pop${up ? " up" : ""}`} role="dialog" aria-label="Appearance">
          <h3 className="display">Make it yours 🎨</h3>
          <Appearance />
        </div>
      )}
    </div>
  );
}
