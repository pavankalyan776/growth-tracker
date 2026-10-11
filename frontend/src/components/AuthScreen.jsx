import { useEffect, useState } from "react";
import Gate from "./Gate";
import Icon from "./icons";
import { useAuth } from "../auth";

/* The hero is a live demo of the product: a Gate that fills quest by quest, closes, and resets. */
function GateDemo() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setN(5); return undefined; }
    const id = window.setTimeout(() => setN((v) => (v >= 7 ? 0 : v + 1)), n === 7 ? 2200 : n === 0 ? 900 : 650);
    return () => window.clearTimeout(id);
  }, [n]);
  return <Gate count={n} total={7} size={300} label="quests cleared" />;
}

const FACTS = [
  { icon: "flame", title: "Streaks with teeth", body: "Miss a day and the System notices. A shield can save the streak." },
  { icon: "coin", title: "Coins you earn", body: "Show up, collect coins, spend them on titles and themes. No real money, ever." },
  { icon: "trophy", title: "Rank from E to S", body: "Thirteen milestones between your first quest and Shadow Monarch." },
];

const rules = (pw) => [
  { ok: pw.length >= 8, text: "At least 8 characters" },
  { ok: /[A-Za-z]/.test(pw) && /\d/.test(pw), text: "A letter and a number" },
];

export default function AuthScreen() {
  const { login, register, notice } = useAuth();
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
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 28V14a11 11 0 0 1 22 0v14" /><path d="M11 28V17a5 5 0 0 1 10 0v11" /></svg>
          <span className="display">Growth Tracker</span>
        </div>
        <div className="auth-hero-main">
          <div className="auth-copy">
            <h1 className="display auth-headline">Arise.</h1>
            <p className="auth-lede">Your daily routine, run like a dungeon. Clear today's gate, protect the streak, and rank up from E to S.</p>
          </div>
          <div className="auth-gate"><GateDemo /></div>
        </div>
        <ul className="auth-facts">
          {FACTS.map((f) => (
            <li key={f.title}><Icon name={f.icon} /><div><b>{f.title}</b><span>{f.body}</span></div></li>
          ))}
        </ul>
      </section>

      <section className="auth-form-wrap">
        <form className="panel auth-form" onSubmit={submit} noValidate>
          <div className="seg" role="tablist" aria-label="Sign in or create an account">
            <button type="button" role="tab" aria-selected={!isRegister} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
            <button type="button" role="tab" aria-selected={isRegister} onClick={() => { setMode("register"); setError(""); }}>Create account</button>
          </div>
          <h2 className="display auth-title">{isRegister ? "Create your hunter account" : "Welcome back, hunter"}</h2>

          {notice && !error ? <div className="alert info" role="status"><Icon name="info" />{notice}</div> : null}
          {error ? <div className="alert error" role="alert"><Icon name="alert" />{error}</div> : null}

          {isRegister && (
            <div className="field">
              <label htmlFor="name">Hunter name</label>
              <input id="name" className="input" value={form.name} onChange={set("name")} autoComplete="nickname" maxLength={20}
                placeholder="What should the System call you?" required />
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
            {busy ? "One moment…" : isRegister ? "Create account" : "Sign in"}
          </button>
          <p className="auth-privacy"><Icon name="lock" className="sm" />Your journal stays private. Admins can see progress numbers, never what you write.</p>
        </form>
      </section>
    </div>
  );
}
