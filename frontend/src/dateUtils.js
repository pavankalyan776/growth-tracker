export const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
export const DOWS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function getToday() {
  return stripTime(new Date());
}

export function toKey(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// "2026-10-03" -> local Date (never goes through UTC, so no off-by-one in India)
export function parseKey(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatShort(d) {
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function formatLong(d) {
  const dow = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
  return `${dow}, ${formatShort(d)}`;
}

export function formatFull(d) {
  return `${formatShort(d)}, ${d.getFullYear()}`;
}

/* ---- "6:15 – 7:00 AM", "10:00 AM – 7:00 PM", "7 AM – 10 PM" -> minutes since midnight ---- */
function toMinutes(h, m, mer) {
  let hh = Number(h) % 12;
  if (mer === "PM") hh += 12;
  return hh * 60 + Number(m || 0);
}

export function parseBlock(label) {
  if (!label) return null;
  const parts = label.replace(/[–—]/g, "-").split("-").map((s) => s.trim());
  const re = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i;
  const parsed = parts.map((p) => {
    const m = p.match(re);
    return m ? { h: m[1], m: m[2], mer: m[3] ? m[3].toUpperCase() : null } : null;
  });
  if (parsed.some((p) => !p)) return null;
  if (parsed.length === 1) {
    const a = parsed[0];
    if (!a.mer) return null;
    const s = toMinutes(a.h, a.m, a.mer);
    return { start: s, end: s + 30 };
  }
  if (parsed.length !== 2) return null;
  const [a, b] = parsed;
  if (!b.mer) return null;
  let start = toMinutes(a.h, a.m, a.mer || b.mer);
  const end = toMinutes(b.h, b.m, b.mer);
  if (!a.mer && start > end) start = toMinutes(a.h, a.m, b.mer === "PM" ? "AM" : "PM");
  return { start, end };
}

export function nowMinutes(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

export function inBlock(block, mins) {
  if (!block) return false;
  return block.end > block.start ? mins >= block.start && mins < block.end : mins >= block.start || mins < block.end;
}

export function fmtMinutes(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const mer = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${mer}`;
}

export function timeAgo(iso) {
  if (!iso) return "never";
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 90) return "just now";
  const mins = secs / 60;
  if (mins < 60) return `${Math.round(mins)} min ago`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)} h ago`;
  const days = hrs / 24;
  if (days < 30) return `${Math.round(days)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
