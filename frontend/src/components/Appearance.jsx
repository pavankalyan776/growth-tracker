import Icon from "./icons";
import { useLook } from "../look";

const STYLES = [
  { key: "adventure", icon: "swords", title: "Adventure", body: "Quests, ranks and bosses. Bold, game-like look." },
  { key: "calm", icon: "leaf", title: "Calm", body: "Habits, tiers and goals. Plain words, soft shapes." },
];
const MODES = [["light", "Day"], ["dark", "Night"], ["system", "Match device"]];
const SIZES = [["standard", "Standard"], ["large", "Large"], ["xl", "Extra large"]];

/* How it feels (style), when it's bright or dark (mode), and how big the text is (size). Used in Profile and in setup. */
export default function Appearance({ compact = false }) {
  const look = useLook();
  return (
    <div className="appearance">
      <div className="field">
        <span className="label" id="look-style">How should this feel?</span>
        <div className="choices two" role="radiogroup" aria-labelledby="look-style">
          {STYLES.map((s) => (
            <button key={s.key} type="button" role="radio" aria-checked={look.style === s.key}
              className={`choice${look.style === s.key ? " is-on" : ""}`} onClick={() => look.setStyle(s.key)}>
              <b className="display"><Icon name={s.icon} className="sm" /> {s.title}</b>
              <span>{s.body}</span>
            </button>
          ))}
        </div>
      </div>
      {!compact && (
        <div className="row wrap appearance-row">
          <div className="field">
            <span className="label" id="look-mode">Brightness</span>
            <div className="seg" role="radiogroup" aria-labelledby="look-mode">
              {MODES.map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={look.modePref === v} aria-pressed={look.modePref === v}
                  onClick={() => look.setMode(v)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="label" id="look-size">Text size</span>
            <div className="seg" role="radiogroup" aria-labelledby="look-size">
              {SIZES.map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={look.size === v} aria-pressed={look.size === v}
                  onClick={() => look.setSize(v)}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
