const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  getQuests: (dayType) => request(`/api/quests${dayType ? `?day_type=${dayType}` : ""}`),
  createQuest: (quest) => request("/api/quests", { method: "POST", body: JSON.stringify(quest) }),
  updateQuest: (id, patch) => request(`/api/quests/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  deleteQuest: (id) => request(`/api/quests/${id}`, { method: "DELETE" }),

  getDay: (dateStr) => request(`/api/day/${dateStr}`),
  toggleCompletion: (questId, dateStr, completed) =>
    request("/api/completions/toggle", {
      method: "POST",
      body: JSON.stringify({ quest_id: questId, date: dateStr, completed }),
    }),

  getStats: () => request("/api/stats"),
  getMilestones: () => request("/api/milestones"),

  useShield: (dateStr) => request("/api/shields", { method: "POST", body: JSON.stringify({ date: dateStr }) }),
  getShields: () => request("/api/shields"),

  getSetting: (key) => request(`/api/settings/${key}`),
  setSetting: (key, value) => request("/api/settings", { method: "POST", body: JSON.stringify({ key, value }) }),
};
