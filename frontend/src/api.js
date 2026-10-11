import { toKey } from "./dateUtils";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "gt-token";

/* Small read cache: opening a page you just visited is instant, and two components asking for the same
   thing share one request. Any write clears it, so a stale answer can never outlive a change. */
const cache = new Map();   // path -> { at, promise }

/* ---- session token (kept in localStorage; every access is guarded because storage can be blocked) ---- */
export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable: the session just lasts until the tab closes */ }
  memoryToken = token || "";
  cache.clear();    // never show one account's cached answers to the next
}
let memoryToken = getToken();

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function friendly(detail, status) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail.map((d) => String(d.msg || "").replace(/^Value error, /, "")).filter(Boolean).join(" ");
  }
  return `Something went wrong (HTTP ${status}).`;
}

export function bustCache() { cache.clear(); }

// Every request carries the browser's own local date as ?today=, so the server
// (which may live in another timezone) never disagrees with you about what day it is.
async function request(path, { method = "GET", body, auth = true } = {}) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${API_BASE}${path}${sep}today=${toKey(new Date())}`;
  const headers = { "Content-Type": "application/json" };
  const token = memoryToken || getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    let detail;
    try { detail = (await res.json()).detail; } catch { /* no JSON body */ }
    if (res.status === 401 && auth && token && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, friendly(detail, res.status));
  }
  return res.json();
}

async function write(path, method, body) {
  try { return await request(path, { method, body }); } finally { bustCache(); }
}
const post = (path, body) => write(path, "POST", body);
const put = (path, body) => write(path, "PUT", body);
const patch = (path, body) => write(path, "PATCH", body);
const del = (path) => write(path, "DELETE");

/* ttl in seconds. `fresh` skips the cache for this call. */
function get(path, ttl = 30) {
  const hit = cache.get(path);
  const now = Date.now();
  if (hit && now - hit.at < ttl * 1000) return hit.promise;
  const promise = request(path).catch((err) => { if (cache.get(path) === entry) cache.delete(path); throw err; });
  const entry = { at: now, promise };
  cache.set(path, entry);
  return promise;
}

export const api = {
  /* ---- accounts ---- */
  register: (email, password, name) => request("/api/auth/register", { method: "POST", body: { email, password, name }, auth: false }),
  login: (email, password) => request("/api/auth/login", { method: "POST", body: { email, password }, auth: false }),
  me: () => request("/api/auth/me"),
  getTemplates: () => get("/api/templates", 300),
  onboard: (template, planStart, planEnd) => post("/api/onboarding", { template, plan_start: planStart, plan_end: planEnd }),
  updatePlan: (planStart, planEnd) => put("/api/plan", { plan_start: planStart, plan_end: planEnd }),
  updateProfile: (fields) => patch("/api/me", fields),
  changePassword: (current, next) => post("/api/auth/change-password", { current_password: current, new_password: next }),
  logoutEverywhere: () => post("/api/auth/logout-all", {}),
  deleteAccount: (password) => post("/api/me/delete", { password }),

  /* ---- tracker ---- */
  getOverview: () => request("/api/overview"),
  getDay: (dateStr) => get(`/api/day/${dateStr}`, 60),
  toggleCompletion: (questId, dateStr, completed) =>
    post("/api/completions/toggle", { quest_id: questId, date: dateStr, completed }),
  getCalendar: (month) => get(`/api/calendar?month=${month}`, 60),
  getHeatmap: () => get("/api/heatmap", 60),
  getAnalytics: () => get("/api/analytics", 60),
  getMilestones: () => get("/api/milestones", 60),

  getQuests: (dayType) => get(`/api/quests${dayType ? `?day_type=${dayType}` : ""}`, 120),
  createQuest: (quest) => post("/api/quests", quest),
  updateQuest: (id, patchBody) => put(`/api/quests/${id}`, patchBody),
  deleteQuest: (id) => del(`/api/quests/${id}`),

  toggleDare: (dateStr, completed) => post("/api/dares/toggle", { date: dateStr, completed }),
  getBoard: () => request("/api/board"),

  getChallenges: () => get("/api/challenges", 60),
  createChallenge: (body) => post("/api/challenges", body),
  checkinChallenge: (id, dateStr, done) => post(`/api/challenges/${id}/checkin`, { date: dateStr, done }),
  archiveChallenge: (id, archived) => patch(`/api/challenges/${id}`, { archived }),
  deleteChallenge: (id) => del(`/api/challenges/${id}`),

  useShield: (dateStr) => post("/api/shields", { date: dateStr }),

  getJournalList: (limit = 15) => get(`/api/journal?limit=${limit}`, 30),
  saveJournal: (dateStr, entry) => put(`/api/journal/${dateStr}`, entry),
  deleteJournal: (dateStr) => del(`/api/journal/${dateStr}`),

  getShop: () => get("/api/shop", 30),
  buyItem: (key) => post("/api/shop/buy", { key }),
  equipItem: (key) => post("/api/shop/equip", { key }),
  exportAll: () => request("/api/export"),

  /* ---- admin ---- */
  adminOverview: () => get("/api/admin/overview", 20),
  adminUsers: (params) => request(`/api/admin/users?${new URLSearchParams(params).toString()}`),
  adminUser: (id) => request(`/api/admin/users/${id}`),
  adminPatchUser: (id, body) => patch(`/api/admin/users/${id}`, body),
  adminForceLogout: (id) => post(`/api/admin/users/${id}/force-logout`, {}),
  adminDeleteUser: (id) => del(`/api/admin/users/${id}`),
  adminAudit: (params) => request(`/api/admin/audit?${new URLSearchParams(params).toString()}`),

  /* content studio: what members see, edited with forms */
  adminDares: () => request("/api/admin/content/dares"),
  adminAddDare: (body) => post("/api/admin/content/dares", body),
  adminEditDare: (id, body) => patch(`/api/admin/content/dares/${id}`, body),
  adminDeleteDare: (id) => del(`/api/admin/content/dares/${id}`),
  adminAnnouncements: () => request("/api/admin/content/announcements"),
  adminAddAnnouncement: (body) => post("/api/admin/content/announcements", body),
  adminEditAnnouncement: (id, body) => patch(`/api/admin/content/announcements/${id}`, body),
  adminDeleteAnnouncement: (id) => del(`/api/admin/content/announcements/${id}`),
  adminTemplates: () => request("/api/admin/content/templates"),
  adminAddTemplate: (body) => post("/api/admin/content/templates", body),
  adminEditTemplate: (key, body) => patch(`/api/admin/content/templates/${key}`, body),
  adminDeleteTemplate: (key) => del(`/api/admin/content/templates/${key}`),

  /* warm the cache for the pages people open next, while the browser is idle */
  prefetch(list = ["getChallenges", "getQuests", "getShop", "getMilestones"]) {
    list.forEach((name) => { try { api[name]().catch(() => {}); } catch { /* ignore */ } });
  },
};
