import { useEffect, useMemo, useState } from "react";
import Icon from "./icons";
import { api } from "../api";
import { useAuth } from "../auth";
import { addDays, formatFull, getToday, parseKey, toKey } from "../dateUtils";

const STEPS = ["Quests", "Plan window", "Enter"];

function defaultEnd(today) {
  const dec31 = new Date(today.getFullYear(), 11, 31);
  return (dec31 - today) / 86400000 >= 14 ? dec31 : addDays(today, 90);
}

export default function Onboarding({ onSkipToAdmin }) {
  const { user, setUser } = useAuth();
  const today = useMemo(getToday, []);
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [template, setTemplate] = useState("exam_ai");
  const [start, setStart] = useState(toKey(today));
  const [end, setEnd] = useState(toKey(defaultEnd(today)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.getTemplates().then(setTemplates).catch(() => {}); }, []);

  const days = start && end ? Math.round((parseKey(end) - parseKey(start)) / 86400000) + 1 : 0;
  const planError = !start || !end ? "Pick both dates." : days < 7 ? "A plan needs at least 7 days." : days > 366 ? "A plan can be at most 366 days." : "";

  const preset = (n) => { setStart(toKey(today)); setEnd(toKey(addDays(today, n - 1))); };
  const chosen = templates.find((t) => t.key === template);

  const finish = async () => {
    setBusy(true);
    setError("");
    try {
      setUser(await api.onboard(template, start, end));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="onboard">
      <div className="onboard-inner">
        <p className="system-line"><span className="chip cyan"><Icon name="sparkle" />System</span> Player detected, {user.name}. Configure your dungeon.</p>
        <ol className="steps" aria-label="Setup progress">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? "is-current" : i < step ? "is-done" : ""} aria-current={i === step ? "step" : undefined}>
              <span className="num">{i < step ? <Icon name="check" className="sm" /> : i + 1}</span>{s}
            </li>
          ))}
        </ol>

        <div className="panel onboard-card">
          {step === 0 && (
            <>
              <h2 className="display">Pick your starting quests</h2>
              <p className="muted">You can edit every quest later. This just saves you the typing.</p>
              <div className="choices" role="radiogroup" aria-label="Quest template">
                {templates.map((t) => (
                  <button key={t.key} type="button" role="radio" aria-checked={template === t.key}
                    className={`choice${template === t.key ? " is-on" : ""}`} onClick={() => setTemplate(t.key)}>
                    <b className="display">{t.label}</b>
                    <span>{t.desc}</span>
                    <small className="chip">{t.quests === 0 ? "No quests yet" : `${t.quests} quests across the week`}</small>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="display">Set your plan window</h2>
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

          {step === 2 && (
            <>
              <h2 className="display">Ready to enter the gate</h2>
              <dl className="summary">
                <div><dt>Hunter</dt><dd>{user.name}</dd></div>
                <div><dt>Quests</dt><dd>{chosen ? chosen.label : template}</dd></div>
                <div><dt>Plan</dt><dd>{formatFull(parseKey(start))} to {formatFull(parseKey(end))}</dd></div>
                <div><dt>Length</dt><dd>{days} days</dd></div>
              </dl>
              {error ? <div className="alert error" role="alert"><Icon name="alert" />{error}</div> : null}
            </>
          )}

          <div className="onboard-actions">
            {step > 0 ? <button type="button" className="btn ghost" onClick={() => setStep(step - 1)} disabled={busy}>Back</button> : <span />}
            {step < 2 ? (
              <button type="button" className="btn" onClick={() => setStep(step + 1)} disabled={step === 1 && !!planError}>Continue</button>
            ) : (
              <button type="button" className="btn" onClick={finish} disabled={busy}>{busy ? "Opening the gate…" : "Enter the gate"}</button>
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
