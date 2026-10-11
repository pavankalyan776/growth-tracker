"""
Game logic: the rules of the System. XP, ranks, streaks, coins, milestones, analytics.

Design notes
- `Snapshot` holds one hunter's whole (tiny) dataset in memory, so every calculation is
  plain Python with no extra queries. The admin console builds many Snapshots from a few
  bulk queries instead of one query per user.
- `reconcile()` is idempotent: it grants every coin reward that is currently due and
  skips the ones already granted. So it is safe to call after any change.
- "today" is always passed in by the caller (the browser sends its local date, which the API
  clamps to within a day of the server clock), so a server running in UTC never disagrees
  with a user in India about what day it is.
- Each hunter has their own plan window (plan_start..plan_end), chosen during onboarding.
"""
import math
from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, Iterable, Iterator, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from . import cache, crud, models
from .dares import DARE_COINS, DARE_XP, build_pool, dare_for, lookup

STAT_KEYS = ["STR", "INT", "PER", "VIT", "AGI"]
MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July",
               "August", "September", "October", "November", "December"]

XP_PER_QUEST = 10
XP_PERFECT_BONUS = 20
XP_PER_LEVEL = 100

BOSS_TARGET = 80      # a week's boss falls when you clear this % of that week's quests
BOSS_XP = 50
BOSS_COINS = 40
BOSS_NAMES = ["The Snooze Hydra", "Procrastination Golem", "The Doubt Wraith", "Scroll Specter", "Couch Dragon",
              "Excuse Titan", "The Distraction Swarm", "Comparison Imp", "Midnight Gremlin", "The Perfection Sphinx"]
BOSS_EMOJI = ["🐍", "🗿", "👻", "📱", "🐉", "⛰️", "🐝", "😈", "🌙", "🦁"]

CHALLENGE_XP = 30             # per challenge a member builds and finishes
CHALLENGE_COINS = 15
CHALLENGE_WEEKLY_CAP = 2      # at most this many challenges per week pay a reward (the rest still count as done)
CHALLENGE_MAX_ACTIVE = 5
CHALLENGE_MIN_DAYS, CHALLENGE_MAX_DAYS = 3, 90

SHIELD_COST = 30
LOGIN_BONUS = 5
PERFECT_BONUS = 10
MONTHLY_BONUS = 100
MONTHLY_TARGET = 80   # average completion % needed for the monthly achievement

# (rank, first level of that rank)
RANKS = [("E", 1), ("D", 6), ("C", 16), ("B", 31), ("A", 51), ("S", 76)]

MILESTONE_DEFS = [
    {"id": "first_blood", "emoji": "🩸", "calm": {"title": "First Step", "desc": "Complete your first habit."}, "title": "First Blood", "desc": "Clear your first quest.",
     "reward": 20, "cond": lambda s: s["total_completed"] >= 1},
    {"id": "week_streak", "emoji": "🔥", "title": "One Week Strong", "desc": "Reach a 7-day streak.",
     "reward": 50, "cond": lambda s: s["longest_streak"] >= 7},
    {"id": "month_streak", "emoji": "🛡️", "calm": {"title": "A Month of Habits", "desc": "Reach a 30-day streak."}, "title": "Iron Will", "desc": "Reach a 30-day streak.",
     "reward": 200, "cond": lambda s: s["longest_streak"] >= 30},
    {"id": "comeback", "emoji": "💪", "title": "Comeback Kid", "desc": "Clear a perfect day right after a missed one.",
     "reward": 40, "cond": lambda s: s["comeback"]},
    {"id": "journal_keeper", "emoji": "📓", "calm": {"title": "Thoughtful Writer", "desc": "Write 7 journal entries."}, "title": "Reflective Hunter", "desc": "Write 7 journal entries.",
     "reward": 30, "cond": lambda s: s["journal_count"] >= 7},
    {"id": "rank_d", "emoji": "🌱", "calm": {"title": "New Tier: Sprout", "desc": "Grow out of the Seed tier."}, "title": "Rank Up: D", "desc": "Climb out of E-rank.",
     "reward": 30, "cond": lambda s: s["rank"] != "E"},
    {"id": "rank_c", "emoji": "🌿", "calm": {"title": "New Tier: Sapling", "desc": "Reach the Sapling tier."}, "title": "Rank Up: C", "desc": "Reach C-rank.",
     "reward": 60, "cond": lambda s: s["rank"] in ("C", "B", "A", "S")},
    {"id": "rank_b", "emoji": "🌳", "calm": {"title": "New Tier: Tree", "desc": "Reach the Tree tier."}, "title": "Rank Up: B", "desc": "Reach B-rank.",
     "reward": 100, "cond": lambda s: s["rank"] in ("B", "A", "S")},
    {"id": "rank_a", "emoji": "🏞️", "calm": {"title": "New Tier: Grove", "desc": "Reach the Grove tier."}, "title": "Rank Up: A", "desc": "Reach A-rank.",
     "reward": 150, "cond": lambda s: s["rank"] in ("A", "S")},
    {"id": "rank_s", "emoji": "👑", "calm": {"title": "New Tier: Forest", "desc": "Reach the top tier."}, "title": "Rank Up: S, Shadow Monarch", "desc": "Reach the top rank.",
     "reward": 300, "cond": lambda s: s["rank"] == "S"},
    {"id": "hundred_quests", "emoji": "💯", "calm": {"title": "Hundred Habits", "desc": "Complete 100 habits in total."}, "title": "Centurion", "desc": "Clear 100 total quests.",
     "reward": 100, "cond": lambda s: s["total_completed"] >= 100},
    {"id": "halfway", "emoji": "⛰️", "title": "Halfway Point", "desc": "Reach the midpoint of your plan.",
     "reward": 50, "cond": lambda s: s["today"] >= s["midpoint"]},
    {"id": "first_dare", "emoji": "🎲", "title": "Dare Accepted", "desc": "Finish your first Daily Dare.",
     "reward": 15, "cond": lambda s: s["dares_done"] >= 1},
    {"id": "dare_10", "emoji": "😎", "title": "Daredevil", "desc": "Finish 10 Daily Dares.",
     "reward": 50, "cond": lambda s: s["dares_done"] >= 10},
    {"id": "dare_30", "emoji": "🦸", "title": "Fearless", "desc": "Finish 30 Daily Dares.",
     "reward": 120, "cond": lambda s: s["dares_done"] >= 30},
    {"id": "boss_1", "emoji": "⚔️", "calm": {"title": "Goal Getter", "desc": "Reach your first weekly goal."}, "title": "Boss Slayer", "desc": "Defeat your first weekly boss.",
     "reward": 50, "cond": lambda s: s["bosses_defeated"] >= 1},
    {"id": "boss_4", "emoji": "🏹", "calm": {"title": "Goal Machine", "desc": "Reach 4 weekly goals."}, "title": "Boss Hunter", "desc": "Defeat 4 weekly bosses.",
     "reward": 150, "cond": lambda s: s["bosses_defeated"] >= 4},
    {"id": "perfect_10", "emoji": "🌟", "title": "Perfect Ten", "desc": "Clear every quest on 10 days.",
     "reward": 60, "cond": lambda s: s["perfect_days"] >= 10},
    {"id": "fortnight", "emoji": "🔥", "title": "Fortnight Flame", "desc": "Reach a 14-day streak.",
     "reward": 80, "cond": lambda s: s["longest_streak"] >= 14},
    {"id": "maker", "emoji": "🧩", "title": "Challenge Maker", "desc": "Finish a challenge you built yourself.",
     "reward": 30, "cond": lambda s: s["challenges_done"] >= 1},
    {"id": "maker_5", "emoji": "🏅", "title": "Challenge Champion", "desc": "Finish 5 challenges you built yourself.",
     "reward": 100, "cond": lambda s: s["challenges_done"] >= 5},
    {"id": "finisher", "emoji": "🏆", "calm": {"title": "Plan Complete", "desc": "Reach the last day of your plan."}, "title": "Final Boss Cleared", "desc": "Reach the last day of your plan.",
     "reward": 500, "cond": lambda s: s["today"] >= s["end"]},
]


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

def day_type(d: date) -> str:
    wd = d.weekday()  # Monday=0 ... Sunday=6
    if wd == 6:
        return "sunday"
    if wd == 5:
        return "saturday"
    return "weekday"


def daterange(start: date, end: date) -> Iterator[date]:
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _avg(values: List[int]) -> int:
    return round(sum(values) / len(values)) if values else 0


def month_end(y: int, m: int) -> date:
    return date(y + (m == 12), (m % 12) + 1, 1) - timedelta(days=1)


# ---------------------------------------------------------------------------
# Snapshot: one hunter's whole dataset in memory
# ---------------------------------------------------------------------------

class Snapshot:
    def __init__(self, start: Optional[date], end: Optional[date], quests: Iterable[models.Quest],
                 completions: Iterable[Tuple[int, date]], shields: Iterable[date],
                 journal: Dict[date, Any], dares: Iterable[date] = (), user_id: int = 0,
                 dare_keys: Optional[Dict[date, str]] = None, custom_dares: Iterable[Any] = (),
                 challenges: Iterable[Any] = (), checkins: Optional[Dict[int, List[date]]] = None):
        # A member who hasn't finished onboarding has no plan yet: an empty window.
        self.start = start
        self.end = end
        self.quests_by_type: Dict[str, List[models.Quest]] = {"weekday": [], "saturday": [], "sunday": []}
        self.quest_by_id: Dict[int, models.Quest] = {}
        for q in sorted(quests, key=lambda q: (q.sort_order or 0, q.id)):
            self.quests_by_type.setdefault(q.day_type, []).append(q)
            self.quest_by_id[q.id] = q
        self.done: Dict[date, Set[int]] = defaultdict(set)
        for quest_id, d in completions:
            self.done[d].add(quest_id)
        self.shields: Set[date] = set(shields)
        self.journal = journal                      # date -> True (only the dates are loaded, never the text)
        self.dares: Set[date] = set(dares)
        self.dare_keys: Dict[date, str] = dare_keys or {}
        self.custom_dares = list(custom_dares)
        self.user_id = user_id
        self.challenges = list(challenges)
        self.checkins: Dict[int, List[date]] = checkins or {}
        # Everything below is derived from the data above and never changes for the life of a Snapshot,
        # so each answer is worked out once and reused (a request asks the same questions several times).
        self._score: Dict[date, dict] = {}
        self._memo: Dict[Any, Any] = {}

    @classmethod
    def load(cls, db: Session, user: models.User) -> "Snapshot":
        uid = user.id
        quests = db.query(models.Quest).filter(models.Quest.user_id == uid).all()
        comps = db.query(models.Completion.quest_id, models.Completion.date).filter(
            models.Completion.user_id == uid, models.Completion.completed == True).all()  # noqa: E712
        shields = [r[0] for r in db.query(models.Shield.date).filter(models.Shield.user_id == uid).all()]
        # Only the DATES of journal entries: the text is fetched separately and only where it is needed.
        journal = {r[0]: True for r in db.query(models.Journal.date).filter(models.Journal.user_id == uid).all()}
        dare_rows = db.query(models.DareDone.date, models.DareDone.dare_key).filter(
            models.DareDone.user_id == uid).all()
        custom = db.query(models.CustomDare).all()
        challenges = db.query(models.Challenge).filter(models.Challenge.user_id == uid).all()
        checkins: Dict[int, List[date]] = defaultdict(list)
        if challenges:
            for cid, d in db.query(models.ChallengeCheckin.challenge_id, models.ChallengeCheckin.date).filter(
                    models.ChallengeCheckin.user_id == uid).all():
                checkins[cid].append(d)
        return cls(user.plan_start, user.plan_end, quests, [(c[0], c[1]) for c in comps], shields, journal,
                   [r[0] for r in dare_rows], uid, {r[0]: r[1] for r in dare_rows if r[1]}, custom,
                   challenges, checkins)

    @classmethod
    def load_many(cls, db: Session, users: List[models.User]) -> Dict[int, "Snapshot"]:
        """Snapshots for several users in a handful of queries (used by the leaderboard)."""
        ids = [u.id for u in users]
        if not ids:
            return {}
        quests, comps, shields, dares = defaultdict(list), defaultdict(list), defaultdict(list), defaultdict(list)
        for q in db.query(models.Quest).filter(models.Quest.user_id.in_(ids)).all():
            quests[q.user_id].append(q)
        for uid, qid, d in db.query(models.Completion.user_id, models.Completion.quest_id,
                                    models.Completion.date).filter(
                models.Completion.user_id.in_(ids), models.Completion.completed == True).all():  # noqa: E712
            comps[uid].append((qid, d))
        for uid, d in db.query(models.Shield.user_id, models.Shield.date).filter(
                models.Shield.user_id.in_(ids)).all():
            shields[uid].append(d)
        for uid, d in db.query(models.DareDone.user_id, models.DareDone.date).filter(
                models.DareDone.user_id.in_(ids)).all():
            dares[uid].append(d)
        challenges, checkins = defaultdict(list), defaultdict(lambda: defaultdict(list))
        for c in db.query(models.Challenge).filter(models.Challenge.user_id.in_(ids)).all():
            challenges[c.user_id].append(c)
        if challenges:
            for uid, cid, d in db.query(models.ChallengeCheckin.user_id, models.ChallengeCheckin.challenge_id,
                                        models.ChallengeCheckin.date).filter(
                    models.ChallengeCheckin.user_id.in_(ids)).all():
                checkins[uid][cid].append(d)
        return {u.id: cls(u.plan_start, u.plan_end, quests[u.id], comps[u.id], shields[u.id], {}, dares[u.id], u.id,
                          challenges=challenges[u.id], checkins=checkins[u.id])
                for u in users}

    # ---- in-place updates (so a write doesn't have to reload everything it just wrote) ----
    def _changed(self, d: Optional[date] = None) -> None:
        if d is not None:
            self._score.pop(d, None)
        self._memo.clear()

    def apply_completion(self, quest_id: int, d: date, completed: bool) -> None:
        if completed:
            self.done[d].add(quest_id)
        else:
            self.done[d].discard(quest_id)
        self._changed(d)

    def apply_dare(self, d: date, done: bool, key: Optional[str] = None) -> None:
        if done:
            self.dares.add(d)
            if key:
                self.dare_keys[d] = key
        else:
            self.dares.discard(d)
            self.dare_keys.pop(d, None)
        self._changed()

    def apply_checkin(self, challenge_id: int, d: date, done: bool) -> None:
        dates = self.checkins.setdefault(challenge_id, [])
        if done and d not in dates:
            dates.append(d)
        elif not done and d in dates:
            dates.remove(d)
        self._changed()

    # ---- plan window ----
    @property
    def has_plan(self) -> bool:
        return self.start is not None and self.end is not None

    def in_plan(self, d: date) -> bool:
        return self.has_plan and self.start <= d <= self.end

    def tracked_days(self, today: date) -> List[date]:
        """Every plan day from the start up to (and including) today."""
        if not self.has_plan:
            return []
        last = min(today, self.end)
        return list(daterange(self.start, last)) if last >= self.start else []

    def plan_days(self) -> int:
        return (self.end - self.start).days + 1 if self.has_plan else 0

    def midpoint(self) -> date:
        return self.start + timedelta(days=self.plan_days() // 2) if self.has_plan else date.max

    # ---- per-day facts ----
    def tasks(self, d: date) -> List[models.Quest]:
        return self.quests_by_type.get(day_type(d), [])

    def done_ids(self, d: date) -> Set[int]:
        return self.done.get(d, set())

    def score(self, d: date) -> dict:
        hit = self._score.get(d)
        if hit is None:
            tasks = self.tasks(d)
            ids = self.done_ids(d)
            count = sum(1 for t in tasks if t.id in ids)
            total = len(tasks)
            hit = self._score[d] = {"count": count, "total": total, "pct": round(count / total * 100) if total else 0}
        return hit

    def is_perfect(self, d: date) -> bool:
        s = self.score(d)
        return s["total"] > 0 and s["pct"] == 100

    def is_shielded(self, d: date) -> bool:
        return d in self.shields

    def dare_done(self, d: date) -> bool:
        return d in self.dares

    def dare_for_day(self, d: date) -> dict:
        """The dare for a day. Finished days keep the dare that was done; others come from the pool as it was that day."""
        key = self.dare_keys.get(d)
        if key:
            found = lookup(key, self.custom_dares)
            if found:
                return found
        if d in self.dares:                  # finished before v5 (no key stored): back then the pool was the built-ins
            return dare_for(self.user_id, d)
        return dare_for(self.user_id, d, build_pool(self.custom_dares, d))

    def challenge_states(self, today: date) -> List[dict]:
        """Every challenge the member built, with progress, status and whether it pays a reward."""
        memo = self._memo.get(("ch", today))
        if memo is not None:
            return memo
        states = []
        for c in sorted(self.challenges, key=lambda c: c.id):
            dates = sorted(self.checkins.get(c.id, ()))
            done = len(dates)
            completed_on = dates[c.target - 1] if done >= c.target else None
            if c.archived:
                status = "archived"
            elif completed_on is not None:
                status = "done"
            elif today < c.start_date:
                status = "upcoming"
            elif today > c.end_date:
                status = "missed"
            else:
                status = "active"
            states.append({
                "id": c.id, "title": c.title, "emoji": c.emoji, "target": c.target, "done": min(done, c.target),
                "start": c.start_date.isoformat(), "end": c.end_date.isoformat(), "status": status,
                "checked_today": today in dates, "completed_on": completed_on.isoformat() if completed_on else None,
                "days_left": max(0, (c.end_date - today).days) if status == "active" else 0,
                "span": (c.end_date - c.start_date).days + 1, "rewarded": False,
                "xp": CHALLENGE_XP, "coins": CHALLENGE_COINS, "_completed_on": completed_on,
            })
        per_week: Dict[date, int] = defaultdict(int)
        for st in sorted((x for x in states if x["_completed_on"] and x["_completed_on"] <= today),
                         key=lambda x: (x["_completed_on"], x["id"])):
            wk = monday_of(st["_completed_on"])
            if per_week[wk] < CHALLENGE_WEEKLY_CAP:
                per_week[wk] += 1
                st["rewarded"] = True
        for st in states:
            del st["_completed_on"]
        self._memo[("ch", today)] = states
        return states

    def is_good(self, d: date) -> bool:
        """A day that keeps the streak alive: perfect, or protected by a shield."""
        return self.is_perfect(d) or self.is_shielded(d)


# ---------------------------------------------------------------------------
# Weekly boss: each Monday-to-Sunday week inside your plan has one
# ---------------------------------------------------------------------------

def boss_week(snap: Snapshot, monday: date, today: date, index: int = 0) -> Optional[dict]:
    """State of one week's boss, or None if the plan has no quests that week."""
    days = [d for d in daterange(monday, monday + timedelta(days=6)) if snap.in_plan(d)]
    possible = sum(len(snap.tasks(d)) for d in days)
    if possible == 0:
        return None
    done = sum(snap.score(d)["count"] for d in days if d <= today)
    hp = max(1, math.ceil(possible * BOSS_TARGET / 100))
    return {
        "week_start": monday.isoformat(), "name": BOSS_NAMES[index % len(BOSS_NAMES)],
        "emoji": BOSS_EMOJI[index % len(BOSS_EMOJI)],
        "possible": possible, "done": done, "hp": hp, "damage": min(done, hp), "remaining": max(0, hp - done),
        "defeated": done >= hp, "reward_coins": BOSS_COINS, "reward_xp": BOSS_XP,
        "days_left": max(0, (monday + timedelta(days=6) - today).days),
    }


def boss_weeks(snap: Snapshot, today: date) -> List[dict]:
    """Every week from the plan start up to today's week, oldest first."""
    hit = snap._memo.get(("boss", today))
    if hit is not None:
        return hit
    out = snap._memo[("boss", today)] = []
    if not snap.has_plan or today < snap.start:
        return out
    cur, last, i = monday_of(snap.start), monday_of(min(today, snap.end)), 0
    while cur <= last:
        week = boss_week(snap, cur, today, i)
        if week:
            out.append(week)
            i += 1
        cur += timedelta(days=7)
    return out


# ---------------------------------------------------------------------------
# Core calculations
# ---------------------------------------------------------------------------

def level_from_xp(xp: int) -> int:
    return xp // XP_PER_LEVEL + 1


def rank_from_level(level: int) -> str:
    # A full 107-day plan with 7 quests a day is worth ~9,630 XP (level 97).
    # S-rank at level 76 (7,500 XP) means roughly 83 perfect days: a real end-game goal.
    rank = "E"
    for name, first_level in RANKS:
        if level >= first_level:
            rank = name
    return rank


def next_rank_info(level: int, xp: int) -> Optional[dict]:
    for name, first_level in RANKS:
        if first_level > level:
            return {"rank": name, "level": first_level, "xp_to_go": (first_level - 1) * XP_PER_LEVEL - xp}
    return None


def compute_progress(snap: Snapshot, today: date) -> dict:
    hit = snap._memo.get(("progress", today))
    if hit is not None:
        return hit
    xp = 0
    total_completed = 0
    perfect_days = 0
    stat_totals = {k: 0 for k in STAT_KEYS}
    dares_done = 0
    for d in snap.tracked_days(today):
        s = snap.score(d)
        xp += s["count"] * XP_PER_QUEST
        total_completed += s["count"]
        if snap.is_perfect(d):
            xp += XP_PERFECT_BONUS
            perfect_days += 1
        if snap.dare_done(d):
            xp += DARE_XP
            dares_done += 1
        ids = snap.done_ids(d)
        for t in snap.tasks(d):
            if t.id in ids and t.stat in stat_totals:
                stat_totals[t.stat] += XP_PER_QUEST
    bosses = sum(1 for w in boss_weeks(snap, today) if w["defeated"])
    xp += bosses * BOSS_XP
    states = snap.challenge_states(today)
    xp += sum(1 for c in states if c["rewarded"]) * CHALLENGE_XP
    level = level_from_xp(xp)
    result = snap._memo[("progress", today)] = {
        "total_xp": xp, "level": level, "rank": rank_from_level(level),
        "total_completed": total_completed, "perfect_days": perfect_days,
        "stat_totals": stat_totals, "dares_done": dares_done, "bosses_defeated": bosses,
        "challenges_done": sum(1 for c in states if c["completed_on"]),
    }
    return result


def compute_streaks(snap: Snapshot, today: date):
    hit = snap._memo.get(("streaks", today))
    if hit is not None:
        return hit
    days = snap.tracked_days(today)
    run = longest = 0
    flags: List[bool] = []
    for d in days:
        good = snap.is_good(d)
        flags.append(good)
        if good:
            run += 1
            longest = max(longest, run)
        else:
            run = 0
    # Today is still in progress: an unfinished today must not break the streak yet.
    if days and days[-1] == today and not flags[-1]:
        flags = flags[:-1]
    current = 0
    for good in reversed(flags):
        if good:
            current += 1
        else:
            break
    snap._memo[("streaks", today)] = (current, longest)
    return current, longest


def has_comeback(snap: Snapshot, today: date) -> bool:
    days = snap.tracked_days(today)
    for prev, cur in zip(days, days[1:]):
        if not snap.is_good(prev) and snap.is_perfect(cur):
            return True
    return False


# ---------------------------------------------------------------------------
# Rewards: idempotent coin granting
# ---------------------------------------------------------------------------

def reconcile(db: Session, snap: Snapshot, user: models.User, today: date) -> List[dict]:
    """Grant every coin reward that is due and not yet granted. Returns the new ones."""
    events: List[dict] = []
    if not snap.has_plan:
        return events
    uid = user.id
    existing = db.query(models.CoinTransaction.date, models.CoinTransaction.reason).filter(
        models.CoinTransaction.user_id == uid).all()
    login_dates = {t[0] for t in existing if t[1] == "Daily login"}
    perfect_dates = {t[0] for t in existing if t[1] == "Perfect day"}
    dare_dates = {t[0] for t in existing if t[1] == "Daily dare"}
    reasons = {t[1] for t in existing}

    def grant(amount: int, reason: str, on: date, kind: str, **extra: Any) -> None:
        crud.add_coin_tx(db, uid, on, amount, reason, commit=False)
        event = {"amount": amount, "reason": reason, "kind": kind}
        event.update(extra)
        events.append(event)

    # 1) Daily login
    if snap.in_plan(today) and today not in login_dates:
        grant(LOGIN_BONUS, "Daily login", today, "login")

    # 2) Perfect days
    days = snap.tracked_days(today)
    for d in days:
        if snap.is_perfect(d) and d not in perfect_dates:
            grant(PERFECT_BONUS, "Perfect day", d, "perfect")

    # 2b) Daily dares
    for d in days:
        if snap.dare_done(d) and d not in dare_dates:
            grant(DARE_COINS, "Daily dare", d, "dare")

    # 2c) Weekly bosses
    for w in boss_weeks(snap, today):
        reason = "Boss defeated {}".format(w["week_start"])
        if w["defeated"] and reason not in reasons:
            grant(BOSS_COINS, reason, today, "boss", boss=w["name"])

    # 2d) Challenges the member built and finished
    for c in snap.challenge_states(today):
        reason = "Challenge done {}".format(c["id"])
        if c["rewarded"] and reason not in reasons:
            grant(CHALLENGE_COINS, reason, today, "challenge", challenge=c["title"], emoji=c["emoji"])

    # 3) Monthly achievement: a finished month with average completion >= target
    for (y, m) in sorted({(d.year, d.month) for d in daterange(snap.start, snap.end)}):
        last = month_end(y, m)
        if today > last:
            pcts = [snap.score(d)["pct"] for d in days if d.year == y and d.month == m]
            reason = "Monthly achievement {}-{:02d}".format(y, m)
            if pcts and _avg(pcts) >= MONTHLY_TARGET and reason not in reasons:
                grant(MONTHLY_BONUS, reason, last, "monthly")

    # 4) Milestones
    prog = compute_progress(snap, today)
    _, longest = compute_streaks(snap, today)
    ctx = {
        "total_completed": prog["total_completed"], "longest_streak": longest, "rank": prog["rank"],
        "today": today, "journal_count": len(snap.journal), "comeback": has_comeback(snap, today),
        "midpoint": snap.midpoint(), "end": snap.end, "dares_done": prog["dares_done"],
        "bosses_defeated": prog["bosses_defeated"], "perfect_days": prog["perfect_days"],
        "challenges_done": prog["challenges_done"],
    }
    achieved = {r[0] for r in db.query(models.MilestoneAchieved.milestone_key).filter(
        models.MilestoneAchieved.user_id == uid).all()}
    for m in MILESTONE_DEFS:
        if m["id"] not in achieved and m["cond"](ctx):
            db.add(models.MilestoneAchieved(user_id=uid, milestone_key=m["id"]))
            grant(m["reward"], "Milestone: " + m["title"], today, "milestone", emoji=m.get("emoji", "🏆"))

    if events:
        db.commit()
    return events


# ---------------------------------------------------------------------------
# View builders (what the API returns)
# ---------------------------------------------------------------------------

def build_overview(db: Session, snap: Snapshot, user: models.User, today: date) -> dict:
    from .shop import DEFAULT_TITLE, ITEMS_BY_KEY, theme_payload

    prog = compute_progress(snap, today)
    current, longest = compute_streaks(snap, today)

    week_days = [d for d in daterange(monday_of(today), monday_of(today) + timedelta(days=6))
                 if snap.has_plan and snap.start <= d <= min(today, snap.end)]
    week_avg = _avg([snap.score(d)["pct"] for d in week_days])

    yesterday = today - timedelta(days=1)
    penalty = None
    if snap.in_plan(yesterday) and snap.tasks(yesterday) and not snap.is_good(yesterday):
        penalty = {"date": yesterday.isoformat(), "pct": snap.score(yesterday)["pct"]}

    today_score = snap.score(today) if snap.in_plan(today) else {"count": 0, "total": 0, "pct": 0}
    title = ITEMS_BY_KEY.get(user.title_key, ITEMS_BY_KEY[DEFAULT_TITLE])
    plan_day = (min(today, snap.end) - snap.start).days + 1 if snap.has_plan and today >= snap.start else 0

    weeks = boss_weeks(snap, today)
    boss = next((w for w in weeks if w["week_start"] == monday_of(today).isoformat()), None)
    return {
        "avatar": user.avatar, "public_board": bool(user.public_board),
        "boss": boss, "bosses_defeated": prog["bosses_defeated"], "dares_done": prog["dares_done"],
        "challenges_done": prog["challenges_done"],
        "challenges": [c for c in snap.challenge_states(today) if c["status"] in ("active", "upcoming", "done")][-20:],
        "announcements": crud.active_announcements(db, today),
        "hunter_name": user.name,
        "title": title["label"], "title_calm": title["calm"], "title_emoji": title.get("emoji", "✨"),
        "theme": theme_payload(user.theme_key),
        "today": today.isoformat(),
        "in_plan": snap.in_plan(today),
        "plan": {"start": snap.start.isoformat() if snap.start else None,
                 "end": snap.end.isoformat() if snap.end else None,
                 "day": plan_day, "days": snap.plan_days(),
                 "days_left": max(0, (snap.end - today).days) if snap.has_plan else 0,
                 "started": bool(snap.has_plan and today >= snap.start)},
        "total_xp": prog["total_xp"], "level": prog["level"], "rank": prog["rank"],
        "xp_into_level": prog["total_xp"] % XP_PER_LEVEL, "xp_per_level": XP_PER_LEVEL,
        "next_rank": next_rank_info(prog["level"], prog["total_xp"]),
        "coins": crud.coin_balance(db, user.id),
        "current_streak": current, "longest_streak": longest,
        "streak_at_risk": bool(current > 0 and today_score["total"] > 0 and today_score["pct"] < 100
                               and snap.in_plan(today)),
        "total_completed": prog["total_completed"], "perfect_days": prog["perfect_days"],
        "stat_totals": prog["stat_totals"],
        "today_score": today_score,
        "week": {"avg": week_avg, "stars": max(0, min(5, round(week_avg / 20)))},
        "penalty": penalty,
        "shield_cost": SHIELD_COST,
    }


def build_day(snap: Snapshot, d: date, today: date, journal: Any = None) -> dict:
    """`journal` is that day's row (the router fetches just that one); the Snapshot holds dates only."""
    ids = snap.done_ids(d)
    j = journal
    score = snap.score(d)
    return {
        "date": d.isoformat(),
        "day_type": day_type(d),
        "in_plan": snap.in_plan(d),
        "is_future": d > today,
        "tasks": [
            {"id": t.id, "label": t.label, "time_label": t.time_label, "stat": t.stat,
             "completed": t.id in ids}
            for t in snap.tasks(d)
        ],
        "score": score,
        "dare": ({**snap.dare_for_day(d), "done": snap.dare_done(d), "xp": DARE_XP, "coins": DARE_COINS}
                 if snap.in_plan(d) else None),
        "shielded": snap.is_shielded(d),
        "can_shield": snap.in_plan(d) and d < today and bool(snap.tasks(d)) and not snap.is_good(d),
        "journal": {"mood": j.mood, "note": j.note, "struggle": j.struggle} if j else None,
    }


def build_calendar(snap: Snapshot, year: int, month: int, today: date) -> dict:
    first = date(year, month, 1)
    last = month_end(year, month)
    days = []
    pcts = []
    for d in daterange(first, last):
        entry = {"date": d.isoformat(), "in_plan": snap.in_plan(d), "is_future": d > today,
                 "shielded": snap.is_shielded(d), "has_journal": d in snap.journal}
        if snap.in_plan(d) and d <= today:
            s = snap.score(d)
            entry.update({"pct": s["pct"], "count": s["count"], "total": s["total"]})
            pcts.append(s["pct"])
        days.append(entry)
    return {"year": year, "month": month, "label": "{} {}".format(MONTH_NAMES[month - 1], year),
            "days": days, "avg": _avg(pcts), "tracked": len(pcts)}


def build_heatmap(snap: Snapshot, today: date) -> List[dict]:
    if not snap.has_plan:
        return []
    out = []
    for d in daterange(snap.start, snap.end):
        if d > today:
            out.append({"date": d.isoformat(), "pct": None, "shielded": False})
        else:
            out.append({"date": d.isoformat(), "pct": snap.score(d)["pct"], "shielded": snap.is_shielded(d)})
    return out


def build_analytics(snap: Snapshot, today: date, struggles: Optional[Dict[date, str]] = None) -> dict:
    """`struggles` maps a date to what the member wrote as hard that day (only the member ever sees it)."""
    struggles = struggles or {}
    days = snap.tracked_days(today)
    scores = {d: snap.score(d) for d in days}

    # ---- weekly series + cumulative stat growth ----
    weeks, stat_growth = [], []
    cumulative = {k: 0 for k in STAT_KEYS}
    if days:
        cur = monday_of(days[0])
        while cur <= days[-1]:
            wdays = [d for d in daterange(cur, cur + timedelta(days=6)) if d in scores]
            for d in wdays:
                ids = snap.done_ids(d)
                for t in snap.tasks(d):
                    if t.id in ids and t.stat in cumulative:
                        cumulative[t.stat] += XP_PER_QUEST
            weeks.append({
                "start": cur.isoformat(), "avg": _avg([scores[d]["pct"] for d in wdays]),
                "days": len(wdays), "perfect": sum(1 for d in wdays if snap.is_perfect(d)),
            })
            point = {"start": cur.isoformat()}
            point.update(cumulative)
            stat_growth.append(point)
            cur += timedelta(days=7)

    # ---- monthly averages ----
    by_month: Dict[tuple, List[int]] = defaultdict(list)
    for d in days:
        by_month[(d.year, d.month)].append(scores[d]["pct"])
    months = [{"key": "{}-{:02d}".format(y, m), "label": MONTH_NAMES[m - 1], "avg": _avg(v), "days": len(v),
               "target": MONTHLY_TARGET}
              for (y, m), v in sorted(by_month.items())]

    # ---- best / worst weekday ----
    by_wd: Dict[int, List[int]] = defaultdict(list)
    for d in days:
        by_wd[d.weekday()].append(scores[d]["pct"])
    weekday = [{"label": n, "avg": _avg(by_wd.get(i, [])), "days": len(by_wd.get(i, []))}
               for i, n in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])]

    # ---- per-quest consistency, then rolled up by stat ----
    quests = []
    stat_done: Dict[str, int] = defaultdict(int)
    stat_possible: Dict[str, int] = defaultdict(int)
    for q in snap.quest_by_id.values():
        eligible = [d for d in days if day_type(d) == q.day_type]
        done = sum(1 for d in eligible if q.id in snap.done_ids(d))
        stat_done[q.stat] += done
        stat_possible[q.stat] += len(eligible)
        quests.append({"id": q.id, "label": q.label, "day_type": q.day_type, "stat": q.stat,
                       "done": done, "possible": len(eligible),
                       "rate": round(done / len(eligible) * 100) if eligible else 0})
    ranked = sorted([q for q in quests if q["possible"] >= 3], key=lambda q: q["rate"])
    per_stat = [{"stat": k, "rate": round(stat_done[k] / stat_possible[k] * 100) if stat_possible[k] else 0,
                 "done": stat_done[k], "possible": stat_possible[k]} for k in STAT_KEYS]

    # ---- failures ledger (past days only: today is still in progress) ----
    missed = []
    for d in reversed(days):
        if d != today and snap.tasks(d) and not snap.is_good(d):
            missed.append({"date": d.isoformat(), "pct": scores[d]["pct"], "struggle": struggles.get(d, "")})
    current, longest = compute_streaks(snap, today)
    prog = compute_progress(snap, today)

    return {
        "summary": {
            "tracked_days": len(days), "avg_completion": _avg([s["pct"] for s in scores.values()]),
            "perfect_days": prog["perfect_days"], "current_streak": current, "longest_streak": longest,
            "missed_days": len(missed),
        },
        "weeks": weeks, "stat_growth": stat_growth, "months": months, "weekday": weekday,
        "per_stat": per_stat, "weakest": ranked[:5], "strongest": list(reversed(ranked[-3:])),
        "missed": missed[:20],
    }


def summarize(snap: Snapshot, today: date) -> dict:
    """The privacy-safe numbers an admin may see about a hunter. No journal text, no quest names."""
    prog = compute_progress(snap, today)
    current, longest = compute_streaks(snap, today)
    days = snap.tracked_days(today)
    pcts = [snap.score(d)["pct"] for d in days]
    last7 = [snap.score(d)["pct"] for d in days[-7:]]
    return {
        "level": prog["level"], "rank": prog["rank"], "total_xp": prog["total_xp"],
        "total_completed": prog["total_completed"], "perfect_days": prog["perfect_days"],
        "current_streak": current, "longest_streak": longest,
        "tracked_days": len(days), "avg_completion": _avg(pcts), "last7_completion": _avg(last7),
        "quest_count": len(snap.quest_by_id), "journal_entries": len(snap.journal),
        "dares_done": prog["dares_done"], "bosses_defeated": prog["bosses_defeated"],
        "challenges_done": prog["challenges_done"], "stat_totals": prog["stat_totals"],
    }


# ---------------------------------------------------------------------------
# The Hall: an opt-in weekly leaderboard
# ---------------------------------------------------------------------------

def week_xp(snap: Snapshot, monday: date, today: date) -> int:
    """XP earned in one Monday-to-Sunday week: quests, perfect days, dares, and the boss if it fell."""
    xp = 0
    for d in daterange(monday, monday + timedelta(days=6)):
        if not snap.in_plan(d) or d > today:
            continue
        xp += snap.score(d)["count"] * XP_PER_QUEST
        if snap.is_perfect(d):
            xp += XP_PERFECT_BONUS
        if snap.dare_done(d):
            xp += DARE_XP
    week = boss_week(snap, monday, today)
    if week and week["defeated"]:
        xp += BOSS_XP
    return xp


def _board_rows(db: Session, today: date) -> List[dict]:
    """The ranked rows, the same for every viewer (so they can be cached for a few seconds)."""
    monday = monday_of(today)
    members = (db.query(models.User)
               .filter(models.User.public_board == True, models.User.is_active == True,  # noqa: E712
                       models.User.onboarded == True).all())
    snaps = Snapshot.load_many(db, members)
    rows = []
    for u in members:
        snap = snaps[u.id]
        prog = compute_progress(snap, today)
        current, _ = compute_streaks(snap, today)
        rows.append({"id": u.id, "name": u.name, "avatar": u.avatar, "level": prog["level"], "rank": prog["rank"],
                     "streak": current, "week_xp": week_xp(snap, monday, today)})
    rows.sort(key=lambda r: (-r["week_xp"], -r["streak"], r["name"].lower()))
    for i, r in enumerate(rows, 1):
        r["place"] = i
    return rows


def build_board(db: Session, viewer: models.User, today: date, limit: int = 25) -> dict:
    """Only people who opted in appear. Each row is name, avatar, level, rank letter, streak and week XP."""
    monday = monday_of(today)
    cached = cache.get_or_set(("board", today), lambda: _board_rows(db, today))
    rows = [{k: v for k, v in r.items() if k != "id"} | {"is_me": r["id"] == viewer.id} for r in cached]
    me = next((r for r in rows if r["is_me"]), None)
    return {
        "opted_in": bool(viewer.public_board), "week_start": monday.isoformat(),
        "week_end": (monday + timedelta(days=6)).isoformat(), "participants": len(rows),
        "rows": rows[:limit], "me": me,
    }
