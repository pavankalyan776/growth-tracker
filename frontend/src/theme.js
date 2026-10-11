/* Light/dark mode and the equipped shop accent. Both are applied as CSS variables on <html>. */
const MODE_KEY = "gt-mode";
const THEME_KEY = "gt-theme";

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function getModePref() {
  const v = read(MODE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "dark";
}

export function resolveMode(pref) {
  if (pref !== "system") return pref;
  const dark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return dark ? "dark" : "light";
}

export function applyMode(pref) {
  write(MODE_KEY, pref);
  document.documentElement.setAttribute("data-mode", resolveMode(pref));
  const saved = read(THEME_KEY);
  if (saved) {
    try { applyAccent(JSON.parse(saved), false); } catch { /* ignore a corrupt value */ }
  }
}

export function applyAccent(theme, persist = true) {
  if (!theme) return;
  const light = document.documentElement.getAttribute("data-mode") === "light";
  const root = document.documentElement.style;
  root.setProperty("--accent", light ? theme.light : theme.fill);
  root.setProperty("--accent-text", light ? theme.light : theme.text);
  root.setProperty("--accent-light", theme.light);
  root.setProperty("--on-accent", light ? "#FFFFFF" : theme.on_fill);
  root.setProperty("--accent-glow", theme.glow);
  if (persist) write(THEME_KEY, JSON.stringify(theme));
}

export function clearAccent() {
  try { localStorage.removeItem(THEME_KEY); } catch { /* ignore */ }
  ["--accent", "--accent-text", "--accent-light", "--on-accent", "--accent-glow"].forEach((p) =>
    document.documentElement.style.removeProperty(p));
}
