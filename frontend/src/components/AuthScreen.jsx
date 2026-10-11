import { useEffect, useState } from "react";
import { Ring } from "./ui";
import Icon from "./icons";
import { useAuth } from "../auth";
import { useLook } from "../look";

/* The hero is a live demo of the product: a Gate that fills quest by quest, closes, and resets. */
function GateDemo({ label }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setN(5); return undefined; }
    const id = window.setTimeout(() => setN((v) => (v >= 7 ? 0 : v + 1)), n === 7 ? 2200 : n === 0 ? 900 : 650);
    return () => window.clearTimeout(id);
  }, [n]);
  return <Ring count={n} total={7} size={260} stroke={20} cap={label} closedCap="All done!" />;
}

const FACTS = {
  adventure: [
    { emoji: "🔥", title: "Streaks with teeth", body: "Miss a day and the System notices. A shield can save the streak." },
    { emoji: "⚔️", title: "Bosses, dares and your own challenges", body: "Beat the weekly boss, try a daily dare, or build a challenge in a minute." },
    { emoji: "🏆", title: "Rank from E to S", body: "22 milestones between your first quest and Shadow Monarch." },
  ],
  calm: [
    { emoji: "🔥", title: "Streaks that keep you going", body: "Do your habits day after day. A streak shield can rescue a missed day." },
    { emoji: "🎯", title: "Goals, dares and your own challenges", body: "A small daily dare, a weekly goal, and challenges you design yourself." },
    { emoji: "🌳", title: "Grow from Seed to Forest", body: "22 milestones mark your progress. No real money, ever." },
  ],
};

const rules = (pw) => [
  { ok: pw.length >= 8, text: "At least 8 characters" },
  { ok: /[A-Za-z]/.test(pw) && /\d/.test(pw), text: "A letter and a number" },
];

export default function AuthScreen() {
  const { login, register, notice } = useAuth();
  const look = useLook();
  const { w } = look;
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isRegister = mode === "register";
  const pwRules = rules(form.password);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (isRegister && !pwRules.every((r) => r.ok)) { setError("Your password needs at least 8 characters, including a letter and a number."); return; }
    setBusy(true);
    try {
      if (isRegister) await register(form.email.trim(), form.password, form.name.trim());
      else await login(form.email.trim(), form.password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <section className="auth-hero" aria-label="About Growth Tracker">
        <div className="auth-brand">
          <span className="brand-mark emoji" aria-hidden="true">🌅</span>
          <span className="display">Growth Tracker</span>
          <span className="spacer" />
          <div className="seg auth-style" role="radiogroup" aria-label="Look and feel">
            {[["adventure", "⚔️ Adventure"], ["calm", "🌱 Calm"]].map(([v, label]) => (
              <button key={v} type="button" role="radio" aria-checked={look.style === v} aria-pressed={look.style === v}
                onClick={() => look.setStyle(v)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="auth-hero-main">
          <div className="auth-copy">
            <h1 className="display auth-headline">{w.authHeadline}</h1>
            <p className="auth-lede">{w.authLede}</p>
          </div>
          <div className="auth-gate"><GateDemo label={w.habitsDone} /></div>
        </div>
        <ul className="auth-facts">
          {FACTS[look.style].map((f) => (
            <li key={f.title}><span className="emoji" aria-hidden="true">{f.emoji}</span><div><b>{f.title}</b><span>{f.body}</span></div></li>
          ))}
        </ul>
      </section>

      <section className="auth-form-wrap">
        <form className="card auth-form" onSubmit={submit} noValidate>
          <div className="seg" role="tablist" aria-label="Sign in or create an account">
            <button type="button" role="tab" aria-selected={!isRegister} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
            <button type="button" role="tab" aria-selected={isRegister} onClick={() => { setMode("register"); setError(""); }}>Create account</button>
          </div>
          <h2 className="display auth-title">{isRegister ? w.createTitle : w.welcomeTitle}</h2>

          {notice && !error ? <div className="alert info" role="status"><Icon name="info" />{notice}</div> : null}
          {error ? <div className="alert error" role="alert"><Icon name="alert" />{error}</div> : null}

          {isRegister && (
            <div className="field">
              <label htmlFor="name">{w.yourName}</label>
              <input id="name" className="input" value={form.name} onChange={set("name")} autoComplete="nickname" maxLength={20}
                placeholder={w.namePlaceholder} required />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={form.email} onChange={set("email")} autoComplete="email" inputMode="email"
              placeholder="you@example.com" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <input id="password" type={show ? "text" : "password"} className="input" value={form.password} onChange={set("password")}
                autoComplete={isRegister ? "new-password" : "current-password"} required />
              <button type="button" className="reveal" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>
                <Icon name={show ? "eyeOff" : "eye"} />
              </button>
            </div>
            {isRegister && (
              <ul className="rules" aria-label="Password rules">
                {pwRules.map((r) => <li key={r.text} className={r.ok ? "ok" : ""}><Icon name={r.ok ? "check" : "x"} className="sm" />{r.text}</li>)}
              </ul>
            )}
          </div>

          <button type="submit" className="btn block" disabled={busy || !form.email || !form.password || (isRegister && !form.name.trim())}>
            {busy ? "One moment…" : isRegister ? "🚀 Create account" : "Sign in"}
          </button>
          <p className="auth-privacy"><span className="emoji" aria-hidden="true">🔒</span>Your journal stays private. Admins can see progress numbers, never what you write.</p>
        </form>
      </section>
    </div>
  );
}
