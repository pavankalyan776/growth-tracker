/*
 * Look and feel, kept on <html> as attributes and CSS variables:
 *   data-mode  light | dark        (Profile > Appearance; "system" follows the device)
 *   data-style adventure | calm    (game words, or plain words; the shapes are the same)
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
  const mode = resolveMode(pref);
  document.documentElement.setAttribute("data-mode", mode);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", mode === "dark" ? "#170F1E" : "#FFF6F1");
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

/* ---------- accent colour (a gradient pair from the equipped shop colour) ---------- */
const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [205, 65, 7];
};

export function applyAccent(theme, persist = true) {
  if (!theme) return;
  const light = document.documentElement.getAttribute("data-mode") !== "dark";
  const root = document.documentElement.style;
  const a = light ? theme.light : theme.fill;
  const b = light ? theme.light2 || theme.light : theme.fill2 || theme.fill;
  const [r, g, bl] = hexToRgb(a);
  root.setProperty("--accent", a);
  root.setProperty("--accent-2", b);
  root.setProperty("--accent-text", light ? theme.light_text || a : theme.text);
  root.setProperty("--on-accent", light ? theme.on_light || "#FFFFFF" : theme.on_fill);
  root.setProperty("--accent-glow", `rgba(${r}, ${g}, ${bl}, ${light ? 0.28 : 0.3})`);
  if (persist) write(THEME_KEY, JSON.stringify(theme));
}

export function clearAccent() {
  try { localStorage.removeItem(THEME_KEY); } catch { /* ignore */ }
  ["--accent", "--accent-2", "--accent-text", "--on-accent", "--accent-glow"].forEach((p) =>
    document.documentElement.style.removeProperty(p));
}
