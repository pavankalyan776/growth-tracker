"""
Game logic — the 'Model' layer in the MVC sense.
All rules about XP, rank, streaks, coins and milestones live here,
kept separate from the database access (crud.py) and the HTTP layer (main.py).
"""
from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_

from . import models

START_DATE = date(2026, 9, 16)
END_DATE = date(2026, 12, 31)

STAT_KEYS = ["STR", "INT", "PER", "VIT", "AGI"]

SHIELD_COST = 30
LOGIN_BONUS = 5
PERFECT_BONUS = 10

MILESTONE_DEFS = [
    {"id": "first_blood", "title": "First Blood", "desc": "Clear your first quest.",
     "reward": 20, "cond": lambda s: s["total_completed"] >= 1},
    {"id": "week_streak", "title": "One Week Strong", "desc": "Reach a 7-day streak.",
     "reward": 50, "cond": lambda s: s["longest_streak"] >= 7},
    {"id": "month_streak", "title": "Iron Will", "desc": "Reach a 30-day streak.",
     "reward": 200, "cond": lambda s: s["longest_streak"] >= 30},
    {"id": "rank_d", "title": "Rank Up — D", "desc": "Climb out of E-rank.",
     "reward": 30, "cond": lambda s: s["rank"] != "E"},
    {"id": "rank_c", "title": "Rank Up — C", "desc": "Reach C-rank.",
     "reward": 60, "cond": lambda s: s["rank"] in ("C", "B", "A", "S")},
    {"id": "rank_b", "title": "Rank Up — B", "desc": "Reach B-rank.",
     "reward": 100, "cond": lambda s: s["rank"] in ("B", "A", "S")},
    {"id": "rank_a", "title": "Rank Up — A", "desc": "Reach A-rank.",
     "reward": 150, "cond": lambda s: s["rank"] in ("A", "S")},
    {"id": "rank_s", "title": "Rank Up — S, Shadow Monarch", "desc": "Reach the top rank.",
     "reward": 300, "cond": lambda s: s["rank"] == "S"},
    {"id": "hundred_quests", "title": "Centurion", "desc": "Clear 100 total quests.",
     "reward": 100, "cond": lambda s: s["total_completed"] >= 100},
    {"id": "halfway", "title": "Halfway Point", "desc": "Reach November 8, the midpoint.",
     "reward": 50, "cond": lambda s: s["today"] >= date(2026, 11, 8)},
    {"id": "finisher", "title": "Final Boss Cleared", "desc": "Reach December 31, 2026.",
     "reward": 500, "cond": lambda s: s["today"] >= END_DATE},
]


def day_type(d: date) -> str:
    wd = d.weekday()  # Monday=0 ... Sunday=6
    if wd == 6:
        return "sunday"
    if wd == 5:
        return "saturday"
    return "weekday"


def last_tracked_day(today: date) -> date:
    return today if today < END_DATE else END_DATE


def get_tasks_for_date(db: Session, d: date):
    return (
        db.query(models.Quest)
        .filter(models.Quest.day_type == day_type(d))
        .order_by(models.Quest.sort_order)
        .all()
    )


def get_completed_quest_ids(db: Session, d: date) -> set:
    rows = (
        db.query(models.Completion.quest_id)
        .filter(models.Completion.date == d, models.Completion.completed == True)  # noqa: E712
        .all()
    )
    return {r[0] for r in rows}


def day_score(db: Session, d: date):
    tasks = get_tasks_for_date(db, d)
    done_ids = get_completed_quest_ids(db, d)
    count = sum(1 for t in tasks if t.id in done_ids)
    total = len(tasks)
    pct = round(count / total * 100) if total else 0
    return {"count": count, "total": total, "pct": pct}


def is_shielded(db: Session, d: date) -> bool:
    return db.query(models.Shield).filter(models.Shield.date == d).first() is not None


def compute_stat_totals(db: Session, today: date):
    totals = {k: 0 for k in STAT_KEYS}
    cursor = START_DATE
    last = last_tracked_day(today)
    # Preload all quests once, keyed by id, to avoid N+1 queries per day
    quests_by_id = {q.id: q for q in db.query(models.Quest).all()}
    while cursor <= last:
        done_ids = get_completed_quest_ids(db, cursor)
        for qid in done_ids:
            q = quests_by_id.get(qid)
            if q and q.stat in totals:
                totals[q.stat] += 10
        cursor += timedelta(days=1)
    return totals


def compute_xp_and_completion(db: Session, today: date):
    xp = 0
    total_completed = 0
    cursor = START_DATE
    last = last_tracked_day(today)
    while cursor <= last:
        s = day_score(db, cursor)
        xp += s["count"] * 10
        total_completed += s["count"]
        if s["total"] > 0 and s["pct"] == 100:
            xp += 20
        cursor += timedelta(days=1)
    return xp, total_completed


def level_from_xp(xp: int) -> int:
    return xp // 100 + 1


def rank_from_level(level: int) -> str:
    if level >= 51:
        return "S"
    if level >= 36:
        return "A"
    if level >= 21:
        return "B"
    if level >= 11:
        return "C"
    if level >= 6:
        return "D"
    return "E"


def compute_streaks(db: Session, today: date):
    cursor = START_DATE
    last = last_tracked_day(today)
    day_list = []
    running = 0
    longest = 0
    while cursor <= last:
        s = day_score(db, cursor)
        good = (s["total"] > 0 and s["pct"] == 100) or is_shielded(db, cursor)
        day_list.append(good)
        if good:
            running += 1
            longest = max(longest, running)
        else:
            running = 0
        cursor += timedelta(days=1)
    current = 0
    for good in reversed(day_list):
        if good:
            current += 1
        else:
            break
    return current, longest


def get_coin_balance(db: Session) -> int:
    total = db.query(models.CoinTransaction).all()
    return sum(t.amount for t in total)


def add_coins(db: Session, today: date, amount: int, reason: str):
    tx = models.CoinTransaction(date=today, amount=amount, reason=reason)
    db.add(tx)
    db.commit()


def compute_global_stats(db: Session, today: date) -> dict:
    xp, total_completed = compute_xp_and_completion(db, today)
    level = level_from_xp(xp)
    rank = rank_from_level(level)
    current_streak, longest_streak = compute_streaks(db, today)
    stat_totals = compute_stat_totals(db, today)
    return {
        "total_xp": xp,
        "level": level,
        "rank": rank,
        "coins": get_coin_balance(db),
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "total_completed": total_completed,
        "stat_totals": stat_totals,
        "today": today,
    }


def check_milestones(db: Session, today: date):
    stats = compute_global_stats(db, today)
    achieved_keys = {m.milestone_key for m in db.query(models.MilestoneAchieved).all()}
    newly = []
    for m in MILESTONE_DEFS:
        if m["id"] not in achieved_keys and m["cond"](stats):
            db.add(models.MilestoneAchieved(milestone_key=m["id"]))
            db.commit()
            add_coins(db, today, m["reward"], f"Milestone: {m['title']}")
            newly.append(m["id"])
    return newly


def run_daily_login_bonus(db: Session, today: date):
    if today < START_DATE or today > END_DATE:
        return
    already = db.query(models.CoinTransaction).filter(
        and_(models.CoinTransaction.date == today, models.CoinTransaction.reason == "Daily login")
    ).first()
    if not already:
        add_coins(db, today, LOGIN_BONUS, "Daily login")


def check_perfect_bonus(db: Session, d: date):
    s = day_score(db, d)
    already = db.query(models.CoinTransaction).filter(
        and_(models.CoinTransaction.date == d, models.CoinTransaction.reason == "Perfect day")
    ).first()
    if s["total"] > 0 and s["pct"] == 100 and not already:
        add_coins(db, d, PERFECT_BONUS, "Perfect day")
