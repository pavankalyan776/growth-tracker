/*
 * Look and feel, kept on <html> as attributes and CSS variables:
 *   data-mode  light | dark        (Profile > Appearance; "system" follows the device)
 *   data-style adventure | calm    (game words and cut corners, or plain words and rounded corners)
 *   data-size  standard | large | xl   (text size, for easier reading)
 *   --accent*  the equipped shop colour
 * Everything is stored in localStorage and applied before first paint (see index.html).
 */
const MODE_KEY = "gt-mode";
const THEME_KEY = "gt-theme";
const STYLE_KEY = "gt-style";
const SIZE_KEY = "gt-size";

export const DEFAULT_MODE = "light";
export const DEFAULT_STYLE = "adventure";   // change to "calm" to make plain words the default for new visitors

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

/* ---------- colour mode ---------- */
export function getModePref() {
  const v = read(MODE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : DEFAULT_MODE;
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

/* ---------- experience style ---------- */
export function getStylePref() {
  const v = read(STYLE_KEY);
  return v === "calm" || v === "adventure" ? v : DEFAULT_STYLE;
}

export function applyStyle(style) {
  write(STYLE_KEY, style);
  document.documentElement.setAttribute("data-style", style);
}

/* ---------- text size ---------- */
export function getSizePref() {
  const v = read(SIZE_KEY);
  return v === "large" || v === "xl" ? v : "standard";
}

export function applySize(size) {
  write(SIZE_KEY, size);
  document.documentElement.setAttribute("data-size", size);
}

/* ---------- accent colour ---------- */
export function applyAccent(theme, persist = true) {
  if (!theme) return;
  const light = document.documentElement.getAttribute("data-mode") !== "dark";
  const root = document.documentElement.style;
  root.setProperty("--accent", light ? theme.light : theme.fill);
  root.setProperty("--accent-text", light ? theme.light_text || theme.light : theme.text);
  root.setProperty("--on-accent", light ? theme.on_light || "#FFFFFF" : theme.on_fill);
  root.setProperty("--accent-glow", theme.glow);
  if (persist) write(THEME_KEY, JSON.stringify(theme));
}

export function clearAccent() {
  try { localStorage.removeItem(THEME_KEY); } catch { /* ignore */ }
  ["--accent", "--accent-text", "--on-accent", "--accent-glow"].forEach((p) =>
    document.documentElement.style.removeProperty(p));
}
