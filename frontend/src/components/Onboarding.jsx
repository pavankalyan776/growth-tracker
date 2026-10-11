import { useEffect, useMemo, useState } from "react";
import Appearance from "./Appearance";
import Avatar, { AVATARS } from "./Avatar";
import Icon from "./icons";
import { api } from "../api";
import { useAuth } from "../auth";
import { useLook } from "../look";
import { addDays, formatFull, getToday, parseKey, toKey } from "../dateUtils";

const STEPS = ["🎨 Your look", "🌱 Starting plan", "🗓️ Dates", "🚀 Begin"];

function defaultEnd(today) {
  const dec31 = new Date(today.getFullYear(), 11, 31);
  return (dec31 - today) / 86400000 >= 14 ? dec31 : addDays(today, 90);
}

export default function Onboarding({ onSkipToAdmin }) {
  const { user, setUser } = useAuth();
  const { w } = useLook();
  const [avatar, setAvatar] = useState(user.avatar || "spark");
  const [name, setName] = useState(user.name || "");
  const today = useMemo(getToday, []);
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [template, setTemplate] = useState("wellbeing");
  const [start, setStart] = useState(toKey(today));
  const [end, setEnd] = useState(toKey(defaultEnd(today)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.getTemplates().then(setTemplates).catch(() => {}); }, []);

  const days = start && end ? Math.round((parseKey(end) - parseKey(start)) / 86400000) + 1 : 0;
  const planError = !start || !end ? "Pick both dates." : days < 7 ? "A plan needs at least 7 days." : days > 366 ? "A plan can be at most 366 days." : "";

  const preset = (n) => { setStart(toKey(today)); setEnd(toKey(addDays(today, n - 1))); };
  const chosen = templates.find((t) => t.key === template);

  const cleanName = name.replace(/\s+/g, " ").trim();
  const nameError = cleanName.length < 2 ? "Use at least 2 characters." : cleanName.length > 20 ? "Use 20 characters or fewer." : /[<>]/.test(cleanName) ? "No < or > please." : "";

  const finish = async () => {
    setBusy(true);
    setError("");
    try {
      if (avatar !== user.avatar) await api.updateProfile({ avatar });
      setUser(await api.onboard(template, start, end, cleanName !== user.name ? cleanName : undefined));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="onboard">
      <div className="onboard-inner">
        <p className="system-line"><span className="chip info">{w.coachEmoji} {w.coach}</span> {w.setupLine(cleanName || user.name)}</p>
        <ol className="steps" aria-label="Setup progress">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? "is-current" : i < step ? "is-done" : ""} aria-current={i === step ? "step" : undefined}>
              <span className="num">{i < step ? <Icon name="check" className="sm" /> : i + 1}</span>{s}
            </li>
          ))}
        </ol>

        <div className="card onboard-card">
          {step === 0 && (
            <>
              <h2 className="display">Make it yours 🎨</h2>
              <p className="muted">You can change all of this later in Profile.</p>
              <div className="field"><label htmlFor="ob-name">{w.yourName}</label>
                <input id="ob-name" className="input" value={name} maxLength={20} autoComplete="nickname" placeholder={w.namePlaceholder}
                  onChange={(e) => setName(e.target.value)} aria-invalid={!!nameError} />
                {nameError ? <p className="error-text" role="alert">{nameError}</p> : <p className="help">This is what you'll see and what the leaderboard shows if you join it. Change it any time in Profile.</p>}
              </div>
              <Appearance />
              <div className="field">
                <span className="label" id="ob-avatar">Pick an avatar</span>
                <div className="avatar-grid" role="radiogroup" aria-labelledby="ob-avatar">
                  {AVATARS.map((a) => (
                    <button key={a} type="button" role="radio" aria-checked={avatar === a} aria-label={a}
                      className={`avatar-pick${avatar === a ? " is-on" : ""}`} onClick={() => setAvatar(a)}>
                      <Avatar name={user.name} avatar={a} size={44} />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="display">{w.pickHabits}</h2>
              <p className="muted">{`You can edit every ${w.habit} later. This just saves you the typing.`}</p>
              <div className="choices" role="radiogroup" aria-label="Starting plan">
                {templates.map((t) => (
                  <button key={t.key} type="button" role="radio" aria-checked={template === t.key}
                    className={`choice${template === t.key ? " is-on" : ""}`} onClick={() => setTemplate(t.key)}>
                    <span className="choice-emoji emoji" aria-hidden="true">{t.emoji}</span>
                    <b className="display">{t.label}</b>
                    <span>{t.desc}</span>
                    {t.preview && t.preview.length > 0 ? <span className="small faint">e.g. {t.preview.slice(0, 4).join(", ")}</span> : null}
                    <small className="chip">{t.quests === 0 ? `No ${w.habitsLower} yet` : `${t.quests} ${w.habitsLower} across the week`}</small>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="display">Set your plan window 🗓️</h2>
              <p className="muted">Streaks, XP and coins only count inside this window. Start in the past to log days you've already done.</p>
              <div className="row wrap" style={{ marginBottom: 16 }}>
                {[[30, "30 days"], [60, "60 days"], [100, "100 days"], [180, "180 days"]].map(([n, label]) => (
                  <button key={n} type="button" className="chip" onClick={() => preset(n)}>{label}</button>
                ))}
              </div>
              <div className="grid-2">
                <div className="field"><label htmlFor="ps">Starts</label>
                  <input id="ps" type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></div>
                <div className="field"><label htmlFor="pe">Ends</label>
                  <input id="pe" type="date" className="input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div>
              </div>
              {planError ? <p className="error-text" role="alert">{planError}</p> : <p className="help">{days} days. Every day inside this window can be cleared.</p>}
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="display">{w.readyTitle} 🚀</h2>
              <dl className="summary">
                <div><dt>Name</dt><dd>{cleanName} <button type="button" className="link-btn small" onClick={() => setStep(0)}>Edit</button></dd></div>
                <div><dt>{w.habits}</dt><dd>{chosen ? `${chosen.emoji} ${chosen.label}` : template}</dd></div>
                <div><dt>Plan</dt><dd>{formatFull(parseKey(start))} to {formatFull(parseKey(end))}</dd></div>
                <div><dt>Length</dt><dd>{days} days</dd></div>
              </dl>
              {error ? <div className="alert error" role="alert"><Icon name="alert" />{error}</div> : null}
            </>
          )}

          <div className="onboard-actions">
            {step > 0 ? <button type="button" className="btn ghost" onClick={() => setStep(step - 1)} disabled={busy}>Back</button> : <span />}
            {step < 3 ? (
              <button type="button" className="btn" onClick={() => setStep(step + 1)} disabled={(step === 0 && !!nameError) || (step === 2 && !!planError)}>Continue</button>
            ) : (
              <button type="button" className="btn" onClick={finish} disabled={busy || !!nameError}>{busy ? "One moment…" : `${w.enter} 🚀`}</button>
            )}
          </div>
        </div>
        {user.role === "admin" && onSkipToAdmin ? (
          <p className="center-text"><button type="button" className="link-btn" onClick={onSkipToAdmin}>Skip for now and open the admin console</button></p>
        ) : null}
      </div>
    </div>
  );
}
