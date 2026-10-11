import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  applyMode, applySize, applyStyle, getModePref, getSizePref, getStylePref, resolveMode,
} from "./theme";

/*
 * One place for how the app talks.
 *   style  adventure | calm      game words, or plain words (same shapes and colours)
 *   mode   light | dark | system
 *   size   standard | large | xl
 * `w` is the word list for the current style. Components say `w.habits`, never "Quests",
 * so a single switch changes the whole vocabulary. Sentences carry their own emoji.
 */

export const TIER_NAMES = { E: "Seed", D: "Sprout", C: "Sapling", B: "Tree", A: "Grove", S: "Forest" };
export const STAT_EMOJI = { STR: "💪", INT: "📚", PER: "🎯", VIT: "🌿", AGI: "⚡" };
export const MOOD_LIST = [[1, "😣", "Rough"], [2, "😕", "Low"], [3, "😐", "Okay"], [4, "🙂", "Good"], [5, "🤩", "Great"]];

const ADVENTURE = {
  style: "adventure",
  habits: "Quests", habit: "quest", habitsLower: "quests", habitsDone: "quests cleared",
  myHabits: "My quests", myHabitsSub: "Your daily templates",
  rewards: "Rewards", rewardsSub: "Spend coins on colours and titles",
  shopTab: "Shop", milestones: "Trophies", milestonesSub: "Milestones and your shadow army",
  hall: "The Hall", hallSub: "Who is leading this week",
  members: "Hunters", memberLower: "hunter",
  yourName: "Hunter name", namePlaceholder: "What should the System call you?",
  coach: "System", coachEmoji: "🤖",
  dayName: "Today's gate", dayPast: "Past gate", dayFuture: "Upcoming gate",
  dayCleared: "Gate cleared", dayLabel: "Daily gate",
  todaySub: "Clear the gate before midnight",
  breach: "Breach: yesterday's gate was left open",
  boss: "Weekly boss", bossLong: "This week's boss", bossDone: "Boss defeated", bossHp: "Boss health",
  dare: "Daily dare", dareDo: "I did it", dareUndo: "Undo",
  statsTitle: "Stats", statsSub: "XP by quest type",
  armyTitle: "Shadow army", armyUnit: "shadow soldier", armyUnits: "shadow soldiers", armyHint: "one per perfect day",
  armyEmpty: "Clear every quest in a day to extract your first.", armyEmoji: "🥷",
  rankUp: "Rank up",
  topRank: "Top rank reached. You are the Shadow Monarch. 👑",
  panelStatus: "Hunter status",
  authHeadline: "Arise. ⚔️",
  authLede: "Your daily routine, run like a dungeon. Clear today's gate, protect the streak, and rank up from E to S.",
  createTitle: "Create your hunter account", welcomeTitle: "Welcome back, hunter 👋",
  pickHabits: "Pick your starting quests", enter: "Enter the gate", readyTitle: "Ready to enter the gate",
  setupLine: (name) => `Player detected, ${name}. Let's configure your dungeon. 🏰`,
  cleared: "cleared", noHabitsToday: "no quests today",
  welcomeKicker: "Daily dungeon", rankKicker: "The System acknowledges you",
  doneLine: (isToday) => (isToday ? "Gate cleared! XP banked. Rest well, hunter. 🌙" : "This gate was cleared. Well fought! 🛡️"),
  openLine: (isToday, total) => (isToday ? `The gate is open. ${total} quests stand between you and a clean day. ⚔️` : "This gate was left open. 🚪"),
  futureLine: "This gate hasn't opened yet. It unlocks at midnight. 🔒",
  levelWord: "Level",
  rankLabel: (r) => `${r}-rank`,
  rankNamed: (r) => `Rank ${r}`,
  leaveBoard: "Leave the Hall", joinBoard: "Show me in the Hall",
  bossLine: (b) => `${b.name}`,
};

const CALM = {
  ...ADVENTURE,
  style: "calm",
  habits: "Habits", habit: "habit", habitsLower: "habits", habitsDone: "habits done",
  myHabits: "My habits", myHabitsSub: "What you do each day",
  milestones: "Milestones", milestonesSub: "Goals you have reached along the way",
  hall: "Leaderboard", hallSub: "Who is leading this week",
  members: "Members", memberLower: "member",
  yourName: "Your name", namePlaceholder: "What should we call you?",
  coach: "Coach", coachEmoji: "🧑‍🏫",
  dayName: "Today", dayPast: "Past day", dayFuture: "Coming up", dayCleared: "Day complete", dayLabel: "Today's habits",
  todaySub: "Your day at a glance",
  breach: "Yesterday was missed",
  boss: "Weekly goal", bossLong: "This week's goal", bossDone: "Goal reached", bossHp: "Goal progress",
  statsTitle: "Strengths", statsSub: "Points by habit type",
  armyTitle: "Perfect days", armyUnit: "perfect day", armyUnits: "perfect days", armyHint: "every habit done",
  armyEmpty: "Finish every habit in a day to grow your first.", armyEmoji: "🌱",
  rankUp: "New tier",
  topRank: "Top tier reached. You are a whole forest. 🌳",
  panelStatus: "Your progress",
  authHeadline: "Grow a little every day. 🌱",
  authLede: "Plan your day, tick off what you do, and watch your streak, your habits and your confidence grow.",
  createTitle: "Create your account", welcomeTitle: "Welcome back 👋",
  pickHabits: "Pick your starting habits", enter: "Start my plan", readyTitle: "Ready to begin",
  setupLine: (name) => `Welcome, ${name}! Let's set up your plan. ✨`,
  cleared: "done", noHabitsToday: "no habits today",
  welcomeKicker: "Well done", rankKicker: "You've grown",
  doneLine: (isToday) => (isToday ? "Everything done! Points banked. Rest well. 🌙" : "You finished everything this day. Well done! 🎉"),
  openLine: (isToday, total) => (isToday ? `${total} habits are waiting for you today. Start with the first one. 🌤️` : "This day was left unfinished. 🌥️"),
  futureLine: "This day hasn't started yet. It opens at midnight. ⏳",
  rankLabel: (r) => TIER_NAMES[r] || r,
  rankNamed: (r) => `Tier: ${TIER_NAMES[r] || r}`,
  leaveBoard: "Leave the leaderboard", joinBoard: "Show me on the leaderboard",
};

const STAT_NAMES = {
  adventure: { STR: "Strength", INT: "Intellect", PER: "Perception", VIT: "Vitality", AGI: "Agility" },
  calm: { STR: "Fitness", INT: "Learning", PER: "Focus", VIT: "Wellbeing", AGI: "Skills" },
};

const WORDS = { adventure: ADVENTURE, calm: CALM };

const LookContext = createContext(null);
export const useLook = () => useContext(LookContext);

export function LookProvider({ children }) {
  const [style, setStyleState] = useState(getStylePref);
  const [size, setSizeState] = useState(getSizePref);
  const [modePref, setModePref] = useState(getModePref);

  const setStyle = useCallback((v) => { applyStyle(v); setStyleState(v); }, []);
  const setSize = useCallback((v) => { applySize(v); setSizeState(v); }, []);
  const setMode = useCallback((v) => { applyMode(v); setModePref(v); }, []);

  const value = useMemo(() => ({
    style, size, modePref, dark: resolveMode(modePref) === "dark",
    setStyle, setSize, setMode,
    toggleMode: () => setMode(resolveMode(modePref) === "dark" ? "light" : "dark"),
    w: WORDS[style] || ADVENTURE,
    stat: STAT_NAMES[style] || STAT_NAMES.adventure,
  }), [style, size, modePref, setStyle, setSize, setMode]);

  return <LookContext.Provider value={value}>{children}</LookContext.Provider>;
}

export function useStatNames() {
  const { stat } = useLook();
  return { name: stat, emoji: STAT_EMOJI };
}
