export const START = new Date(2026, 8, 16);
export const END = new Date(2026, 11, 31);

export function stripTime(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
export function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
export function clampDate(d, min, max) { return d < min ? new Date(min) : d > max ? new Date(max) : new Date(d); }
export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function inRange(d) { return d >= START && d <= END; }
export function mondayOf(d) {
  const wd = d.getDay();
  const diff = wd === 0 ? -6 : 1 - wd;
  return addDays(d, diff);
}

export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const DOWS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
export const TODAY = stripTime(new Date());
