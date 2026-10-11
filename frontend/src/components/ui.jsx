import { useEffect, useRef, useState } from "react";
import Icon from "./icons";

/* Small shared pieces. Kept in one file so a page imports once and the bundle stays one chunk. */

export const Emoji = ({ children, label, className = "" }) => (
  <span className={`emoji ${className}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>{children}</span>
);

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert error" role="alert"><Icon name="alert" />{error}
      {onRetry ? <button type="button" className="link-btn" onClick={onRetry}>Retry</button> : null}
    </div>
  );
}

export const Skeletons = ({ n = 3, h = 72 }) => (
  <div className="stack" aria-hidden="true">{Array.from({ length: n }, (_, i) => <div key={i} className="skel" style={{ height: h }} />)}</div>
);

export function Empty({ emoji = "🌤️", title, children }) {
  return (
    <div className="empty">
      <Emoji className="empty-emoji">{emoji}</Emoji>
      <div className="display">{title}</div>
      {children}
    </div>
  );
}

export function Bar({ value, max = 100, tone = "", label, thin = false }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`bar ${tone} ${thin ? "thin" : ""}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/* Progress ring: SVG circle, drawn with a dash offset so it animates on the compositor. */
export function Ring({ count, total, size = 168, stroke = 14, cap = "", closedCap = "", onCard = false, ariaLabel }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, count / total) : 0;
  const done = total > 0 && count >= total;
  return (
    <div className={`ring${onCard ? " on-card" : ""}${done ? " is-done" : ""}`} style={{ width: size, height: size }}
      role="img" aria-label={ariaLabel || `${count} of ${total}`}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle className="ring-fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <div className="ring-center">
        <span className="ring-big">{done ? "🎉" : <>{count}<small>/{total}</small></>}</span>
        <span className="ring-cap">{done ? closedCap : cap}</span>
      </div>
    </div>
  );
}

/* A round gradient badge with the rank letter. S rank turns golden. */
export function RankBadge({ rank, size = 72, emoji }) {
  return (
    <div className={`rank-badge${rank === "S" ? " s" : ""}`} style={{ width: size, height: size, fontSize: size * 0.46 }} role="img" aria-label={`Rank ${rank}`}>
      {rank}
      {emoji ? <small className="emoji" style={{ fontSize: size * 0.2 }}>{emoji}</small> : null}
    </div>
  );
}

/* Modal dialog: Escape and the backdrop close it, focus moves in, and returns to where it was. */
export function Dialog({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const first = ref.current && ref.current.querySelector("input, textarea, select, button:not([data-close])");
    (first || ref.current).focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (prev && prev.focus) prev.focus(); };
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1} style={wide ? { width: "min(760px, 100%)" } : undefined}>
        <div className="dialog-head">
          <h2 className="display">{title}</h2>
          <button type="button" data-close className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const EMOJI_SETS = {
  challenge: ["🎯", "🏃", "📚", "🧘", "💧", "🥗", "😴", "✍️", "🎸", "🧹", "💪", "🚶", "🎨", "💻", "🌞", "📵"],
  dare: ["✨", "🎲", "💪", "🧠", "💌", "🏠", "🚶", "🥤", "📞", "🧘", "🙏", "🌳", "🎵", "🍎", "🧼", "📖"],
  announce: ["📣", "🎉", "🆕", "💡", "🔥", "🎁", "🏆", "🌈", "⚠️", "🛠️", "📅", "🌟"],
  plan: ["🌱", "🎒", "🧠", "🎯", "✨", "🌿", "🏋️", "📖", "🧘", "🚀", "🎨", "💼"],
};

/* A grid of emojis to pick from, plus a box to type any other single emoji. */
export function EmojiPicker({ value, onChange, set = "challenge", label = "Emoji" }) {
  const list = EMOJI_SETS[set] || EMOJI_SETS.challenge;
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="emoji-picker" role="radiogroup" aria-label={label}>
        {list.map((e) => (
          <button key={e} type="button" role="radio" aria-checked={value === e} aria-label={e} onClick={() => onChange(e)}>{e}</button>
        ))}
        <input className="input" style={{ width: 84, minHeight: 44 }} maxLength={8} value={list.includes(value) ? "" : value}
          onChange={(e) => onChange(e.target.value.replace(/[A-Za-z0-9<>&"'`\s]/g, ""))} placeholder="Other" aria-label="Type another emoji" />
      </div>
    </div>
  );
}

export function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms, setV]);
  return v;
}

