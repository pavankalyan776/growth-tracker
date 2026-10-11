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
from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, Iterable, Iterator, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from . import crud, models

STAT_KEYS = ["STR", "INT", "PER", "VIT", "AGI"]
MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July",
               "August", "September", "October", "November", "December"]

XP_PER_QUEST = 10
XP_PERFECT_BONUS = 20
XP_PER_LEVEL = 100

SHIELD_COST = 30
LOGIN_BONUS = 5
PERFECT_BONUS = 10
MONTHLY_BONUS = 100
MONTHLY_TARGET = 80   # average completion % needed for the monthly achievement

# (rank, first level of that rank)
RANKS = [("E", 1), ("D", 6), ("C", 16), ("B", 31), ("A", 51), ("S", 76)]

MILESTONE_DEFS = [
    {"id": "first_blood", "title": "First Blood", "desc": "Clear your first quest.",
     "reward": 20, "cond": lambda s: s["total_completed"] >= 1},
    {"id": "week_streak", "title": "One Week Strong", "desc": "Reach a 7-day streak.",
     "reward": 50, "cond": lambda s: s["longest_streak"] >= 7},
    {"id": "month_streak", "title": "Iron Will", "desc": "Reach a 30-day streak.",
     "reward": 200, "cond": lambda s: s["longest_streak"] >= 30},
    {"id": "comeback", "title": "Comeback Kid", "desc": "Clear a perfect day right after a missed one.",
     "reward": 40, "cond": lambda s: s["comeback"]},
    {"id": "journal_keeper", "title": "Reflective Hunter", "desc": "Write 7 journal entries.",
     "reward": 30, "cond": lambda s: s["journal_count"] >= 7},
    {"id": "rank_d", "title": "Rank Up: D", "desc": "Climb out of E-rank.",
     "reward": 30, "cond": lambda s: s["rank"] != "E"},
    {"id": "rank_c", "title": "Rank Up: C", "desc": "Reach C-rank.",
     "reward": 60, "cond": lambda s: s["rank"] in ("C", "B", "A", "S")},
    {"id": "rank_b", "title": "Rank Up: B", "desc": "Reach B-rank.",
     "reward": 100, "cond": lambda s: s["rank"] in ("B", "A", "S")},
    {"id": "rank_a", "title": "Rank Up: A", "desc": "Reach A-rank.",
     "reward": 150, "cond": lambda s: s["rank"] in ("A", "S")},
    {"id": "rank_s", "title": "Rank Up: S, Shadow Monarch", "desc": "Reach the top rank.",
     "reward": 300, "cond": lambda s: s["rank"] == "S"},
    {"id": "hundred_quests", "title": "Centurion", "desc": "Clear 100 total quests.",
     "reward": 100, "cond": lambda s: s["total_completed"] >= 100},
    {"id": "halfway", "title": "Halfway Point", "desc": "Reach the midpoint of your plan.",
     "reward": 50, "cond": lambda s: s["today"] >= s["midpoint"]},
    {"id": "finisher", "title": "Final Boss Cleared", "desc": "Reach the last day of your plan.",
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
                 journal: Dict[date, Any]):
        # A hunter who hasn't finished onboarding has no plan yet: an empty window.
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
        self.journal = journal

    @classmethod
    def load(cls, db: Session, user: models.User) -> "Snapshot":
        uid = user.id
        quests = db.query(models.Quest).filter(models.Quest.user_id == uid).all()
        comps = db.query(models.Completion.quest_id, models.Completion.date).filter(
            models.Completion.user_id == uid, models.Completion.completed == True).all()  # noqa: E712
        shields = [r[0] for r in db.query(models.Shield.date).filter(models.Shield.user_id == uid).all()]
        journal = {j.date: j for j in db.query(models.Journal).filter(models.Journal.user_id == uid).all()}
        return cls(user.plan_start, user.plan_end, quests, [(c[0], c[1]) for c in comps], shields, journal)

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
        tasks = self.tasks(d)
        ids = self.done_ids(d)
        count = sum(1 for t in tasks if t.id in ids)
        total = len(tasks)
        return {"count": count, "total": total, "pct": round(count / total * 100) if total else 0}

    def is_perfect(self, d: date) -> bool:
        s = self.score(d)
        return s["total"] > 0 and s["pct"] == 100

    def is_shielded(self, d: date) -> bool:
        return d in self.shields

    def is_good(self, d: date) -> bool:
        """A day that keeps the streak alive: perfect, or protected by a shield."""
        return self.is_perfect(d) or self.is_shielded(d)


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
    xp = 0
    total_completed = 0
    perfect_days = 0
    stat_totals = {k: 0 for k in STAT_KEYS}
    for d in snap.tracked_days(today):
        s = snap.score(d)
        xp += s["count"] * XP_PER_QUEST
        total_completed += s["count"]
        if snap.is_perfect(d):
            xp += XP_PERFECT_BONUS
            perfect_days += 1
        ids = snap.done_ids(d)
        for t in snap.tasks(d):
            if t.id in ids and t.stat in stat_totals:
                stat_totals[t.stat] += XP_PER_QUEST
    level = level_from_xp(xp)
    return {
        "total_xp": xp, "level": level, "rank": rank_from_level(level),
        "total_completed": total_completed, "perfect_days": perfect_days,
        "stat_totals": stat_totals,
    }


def compute_streaks(snap: Snapshot, today: date):
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
    existing = db.query(models.CoinTransaction).filter(models.CoinTransaction.user_id == uid).all()
    login_dates = {t.date for t in existing if t.reason == "Daily login"}
    perfect_dates = {t.date for t in existing if t.reason == "Perfect day"}
    reasons = {t.reason for t in existing}

    def grant(amount: int, reason: str, on: date, kind: str) -> None:
        crud.add_coin_tx(db, uid, on, amount, reason, commit=False)
        events.append({"amount": amount, "reason": reason, "kind": kind})

    # 1) Daily login
    if snap.in_plan(today) and today not in login_dates:
        grant(LOGIN_BONUS, "Daily login", today, "login")

    # 2) Perfect days
    days = snap.tracked_days(today)
    for d in days:
        if snap.is_perfect(d) and d not in perfect_dates:
            grant(PERFECT_BONUS, "Perfect day", d, "perfect")

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
        "midpoint": snap.midpoint(), "end": snap.end,
    }
    achieved = {m.milestone_key for m in
                db.query(models.MilestoneAchieved).filter(models.MilestoneAchieved.user_id == uid).all()}
    for m in MILESTONE_DEFS:
        if m["id"] not in achieved and m["cond"](ctx):
            db.add(models.MilestoneAchieved(user_id=uid, milestone_key=m["id"]))
            grant(m["reward"], "Milestone: " + m["title"], today, "milestone")

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

    return {
        "hunter_name": user.name,
        "title": title["label"],
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


def build_day(snap: Snapshot, d: date, today: date) -> dict:
    ids = snap.done_ids(d)
    j = snap.journal.get(d)
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


def build_analytics(snap: Snapshot, today: date) -> dict:
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
            j = snap.journal.get(d)
            missed.append({"date": d.isoformat(), "pct": scores[d]["pct"],
                           "struggle": j.struggle if j else ""})
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
        "stat_totals": prog["stat_totals"],
    }
