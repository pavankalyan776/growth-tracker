import { toKey } from "./dateUtils";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "gt-token";

/* ---- session token (kept in localStorage; every access is guarded because storage can be blocked) ---- */
export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable: the session just lasts until the tab closes */ }
  memoryToken = token || "";
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

const post = (path, body) => request(path, { method: "POST", body });
const put = (path, body) => request(path, { method: "PUT", body });
const patch = (path, body) => request(path, { method: "PATCH", body });
const del = (path) => request(path, { method: "DELETE" });

export const api = {
  /* ---- accounts ---- */
  register: (email, password, name) => request("/api/auth/register", { method: "POST", body: { email, password, name }, auth: false }),
  login: (email, password) => request("/api/auth/login", { method: "POST", body: { email, password }, auth: false }),
  me: () => request("/api/auth/me"),
  getTemplates: () => request("/api/templates", { auth: false }),
  onboard: (template, planStart, planEnd) => post("/api/onboarding", { template, plan_start: planStart, plan_end: planEnd }),
  updatePlan: (planStart, planEnd) => put("/api/plan", { plan_start: planStart, plan_end: planEnd }),
  updateProfile: (name) => patch("/api/me", { name }),
  changePassword: (current, next) => post("/api/auth/change-password", { current_password: current, new_password: next }),
  logoutEverywhere: () => post("/api/auth/logout-all", {}),
  deleteAccount: (password) => post("/api/me/delete", { password }),

  /* ---- tracker ---- */
  getOverview: () => request("/api/overview"),
  getDay: (dateStr) => request(`/api/day/${dateStr}`),
  toggleCompletion: (questId, dateStr, completed) =>
    post("/api/completions/toggle", { quest_id: questId, date: dateStr, completed }),
  getCalendar: (month) => request(`/api/calendar?month=${month}`),
  getHeatmap: () => request("/api/heatmap"),
  getAnalytics: () => request("/api/analytics"),
  getMilestones: () => request("/api/milestones"),

  getQuests: (dayType) => request(`/api/quests${dayType ? `?day_type=${dayType}` : ""}`),
  createQuest: (quest) => post("/api/quests", quest),
  updateQuest: (id, patchBody) => put(`/api/quests/${id}`, patchBody),
  deleteQuest: (id) => del(`/api/quests/${id}`),

  useShield: (dateStr) => post("/api/shields", { date: dateStr }),

  getJournalList: (limit = 15) => request(`/api/journal?limit=${limit}`),
  saveJournal: (dateStr, entry) => put(`/api/journal/${dateStr}`, entry),
  deleteJournal: (dateStr) => del(`/api/journal/${dateStr}`),

  getShop: () => request("/api/shop"),
  buyItem: (key) => post("/api/shop/buy", { key }),
  equipItem: (key) => post("/api/shop/equip", { key }),
  exportAll: () => request("/api/export"),

  /* ---- admin ---- */
  adminOverview: () => request("/api/admin/overview"),
  adminUsers: (params) => request(`/api/admin/users?${new URLSearchParams(params).toString()}`),
  adminUser: (id) => request(`/api/admin/users/${id}`),
  adminPatchUser: (id, body) => patch(`/api/admin/users/${id}`, body),
  adminForceLogout: (id) => post(`/api/admin/users/${id}/force-logout`, {}),
  adminDeleteUser: (id) => del(`/api/admin/users/${id}`),
  adminAudit: (params) => request(`/api/admin/audit?${new URLSearchParams(params).toString()}`),
};
