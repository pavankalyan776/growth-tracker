"""
Admin console API (RBAC).

What an admin CAN see: account facts (email, name, role, status, sign-up / last-active times) and
aggregate progress numbers (level, rank, streak, completion %).
What an admin can NOT see: journal text, quest names, or anything a hunter wrote. There is no
endpoint that returns it, and the tests assert that.

Every route requires role == "admin" on the server. Every admin action is written to the audit log.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import crud, game_logic, models, schemas
from ..database import get_db
from ..deps import require_admin, resolve_today
from ..models import utcnow

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])

SORTS = {"joined", "active", "level", "streak", "completion", "name"}


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() + "Z" if dt else None


# ---------------------------------------------------------------------------
# Bulk loading: a handful of queries for ALL users, then pure-Python maths.
# (Fine for hundreds of users. At thousands, move these rollups into SQL or a nightly job.)
# ---------------------------------------------------------------------------

def _load_world(db: Session) -> Dict[str, Any]:
    quests, comps, shields, journal = defaultdict(list), defaultdict(list), defaultdict(list), defaultdict(dict)
    for q in db.query(models.Quest).all():
        quests[q.user_id].append(q)
    comp_by_day: Dict[date, set] = defaultdict(set)
    comp_count_by_day: Dict[date, int] = defaultdict(int)
    for uid, qid, d in db.query(models.Completion.user_id, models.Completion.quest_id,
                                models.Completion.date).filter(models.Completion.completed == True).all():  # noqa: E712
        comps[uid].append((qid, d))
        comp_by_day[d].add(uid)
        comp_count_by_day[d] += 1
    for uid, d in db.query(models.Shield.user_id, models.Shield.date).all():
        shields[uid].append(d)
    dares = defaultdict(list)
    for uid, d in db.query(models.DareDone.user_id, models.DareDone.date).all():
        dares[uid].append(d)
    # Only the DATE of each journal entry is loaded. The text never leaves the database here.
    for uid, d in db.query(models.Journal.user_id, models.Journal.date).all():
        journal[uid][d] = True
    return {"quests": quests, "comps": comps, "shields": shields, "journal": journal, "dares": dares,
            "active_by_day": comp_by_day, "count_by_day": comp_count_by_day}


def _snapshot_for(user: models.User, world: Dict[str, Any]) -> game_logic.Snapshot:
    return game_logic.Snapshot(user.plan_start, user.plan_end, world["quests"].get(user.id, []),
                               world["comps"].get(user.id, []), world["shields"].get(user.id, []),
                               world["journal"].get(user.id, {}), world["dares"].get(user.id, []), user.id)


def _row(user: models.User, world: Dict[str, Any], today: date) -> dict:
    stats = game_logic.summarize(_snapshot_for(user, world), today) if user.onboarded and user.plan_start else None
    return {
        "id": user.id, "email": user.email, "name": user.name, "role": user.role,
        "is_active": user.is_active, "onboarded": user.onboarded,
        "created_at": _iso(user.created_at), "last_login_at": _iso(user.last_login_at),
        "last_active_at": _iso(user.last_active_at),
        "stats": stats,
    }


def _get_target(db: Session, user_id: int) -> models.User:
    target = crud.get_user(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    return target


# ---------------------------------------------------------------------------
# Overview
# ---------------------------------------------------------------------------

@router.get("/overview")
def overview(today: date = Depends(resolve_today), db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    world = _load_world(db)
    now = utcnow()

    rows = [_row(u, world, today) for u in users]
    with_stats = [r["stats"] for r in rows if r["stats"] and r["stats"]["tracked_days"] > 0]

    def active_since(days: int) -> int:
        cutoff = now - timedelta(days=days)
        return sum(1 for u in users if u.last_active_at and u.last_active_at >= cutoff)

    signups = defaultdict(int)
    for u in users:
        signups[u.created_at.date()] += 1
    window = [today - timedelta(days=i) for i in range(29, -1, -1)]
    series = [{"date": d.isoformat(), "signups": signups.get(d, 0),
               "active_hunters": len(world["active_by_day"].get(d, ())),
               "quests_cleared": world["count_by_day"].get(d, 0)} for d in window]

    rank_dist = {r: 0 for r, _ in game_logic.RANKS}
    for s in with_stats:
        rank_dist[s["rank"]] += 1

    funnel = [
        {"step": "Registered", "count": len(users)},
        {"step": "Set up a plan", "count": sum(1 for u in users if u.onboarded)},
        {"step": "Cleared a quest", "count": sum(1 for u in users if world["comps"].get(u.id))},
        {"step": "3-day streak", "count": sum(1 for s in with_stats if s["longest_streak"] >= 3)},
        {"step": "7-day streak", "count": sum(1 for s in with_stats if s["longest_streak"] >= 7)},
    ]

    recent = (db.query(models.AuditLog).order_by(models.AuditLog.id.desc()).limit(8).all())
    return {
        "totals": {
            "users": len(users),
            "active_accounts": sum(1 for u in users if u.is_active),
            "disabled": sum(1 for u in users if not u.is_active),
            "admins": sum(1 for u in users if u.role == "admin"),
            "onboarded": sum(1 for u in users if u.onboarded),
            "new_7d": sum(1 for u in users if u.created_at >= now - timedelta(days=7)),
            "active_1d": active_since(1), "active_7d": active_since(7), "active_30d": active_since(30),
            "quests_cleared": sum(len(v) for v in world["comps"].values()),
            "avg_completion_7d": round(sum(s["last7_completion"] for s in with_stats) / len(with_stats)) if with_stats else 0,
            "avg_streak": round(sum(s["current_streak"] for s in with_stats) / len(with_stats), 1) if with_stats else 0,
        },
        "series": series,
        "rank_distribution": [{"rank": r, "count": c} for r, c in rank_dist.items()],
        "funnel": funnel,
        "recent_audit": [_audit_out(a) for a in recent],
    }


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@router.get("/users")
def list_users(
    q: str = Query(default="", max_length=100),
    role: str = Query(default="", pattern=r"^(|user|admin)$"),
    status: str = Query(default="", pattern=r"^(|active|disabled)$"),
    sort: str = "joined", order: str = Query(default="desc", pattern=r"^(asc|desc)$"),
    page: int = Query(default=1, ge=1), page_size: int = Query(default=20, ge=1, le=100),
    today: date = Depends(resolve_today), db: Session = Depends(get_db),
):
    if sort not in SORTS:
        raise HTTPException(status_code=400, detail="Unknown sort.")
    query = db.query(models.User)
    if q.strip():
        like = "%{}%".format(q.strip().lower().replace("%", "").replace("_", ""))
        query = query.filter(func.lower(models.User.email).like(like) | func.lower(models.User.name).like(like))
    if role:
        query = query.filter(models.User.role == role)
    if status:
        query = query.filter(models.User.is_active == (status == "active"))
    users = query.all()
    world = _load_world(db)
    rows = [_row(u, world, today) for u in users]

    def key(r: dict):
        s = r["stats"] or {}
        return {
            "joined": r["created_at"] or "", "active": r["last_active_at"] or "",
            "level": s.get("level", 0), "streak": s.get("current_streak", 0),
            "completion": s.get("avg_completion", 0), "name": r["name"].lower(),
        }[sort]

    rows.sort(key=key, reverse=(order == "desc"))
    total = len(rows)
    start = (page - 1) * page_size
    return {"total": total, "page": page, "page_size": page_size, "items": rows[start:start + page_size]}


@router.get("/users/{user_id}")
def user_detail(user_id: int, admin: models.User = Depends(require_admin), today: date = Depends(resolve_today),
                db: Session = Depends(get_db)):
    target = _get_target(db, user_id)
    world = _load_world(db)
    snap = _snapshot_for(target, world)
    row = _row(target, world, today)

    recent_days = []
    if snap.has_plan:
        for d in snap.tracked_days(today)[-28:]:
            recent_days.append({"date": d.isoformat(), "pct": snap.score(d)["pct"]})
    row.update({
        "plan_start": target.plan_start.isoformat() if target.plan_start else None,
        "plan_end": target.plan_end.isoformat() if target.plan_end else None,
        "coins": crud.coin_balance(db, target.id),
        "recent_days": recent_days,
    })
    # Accountability: record who looked at whose profile (once per 10 minutes per pair).
    cutoff = utcnow() - timedelta(minutes=10)
    seen = (db.query(models.AuditLog).filter(
        models.AuditLog.action == "admin.view_user", models.AuditLog.actor_id == admin.id,
        models.AuditLog.target_id == target.id, models.AuditLog.created_at >= cutoff).first())
    if not seen:
        crud.audit(db, "admin.view_user", actor=admin, target=target)
    history = (db.query(models.AuditLog)
               .filter((models.AuditLog.target_id == target.id) | (models.AuditLog.actor_id == target.id))
               .filter(models.AuditLog.action != "admin.view_user")
               .order_by(models.AuditLog.id.desc()).limit(10).all())
    row["history"] = [_audit_out(a) for a in history]
    return row


@router.patch("/users/{user_id}")
def patch_user(user_id: int, payload: schemas.AdminUserPatch, admin: models.User = Depends(require_admin),
               db: Session = Depends(get_db)):
    target = _get_target(db, user_id)
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="You can't change your own role or status.")
    if payload.role is None and payload.is_active is None:
        raise HTTPException(status_code=400, detail="Nothing to change.")

    losing_admin = target.role == "admin" and target.is_active and (
        payload.role == "user" or payload.is_active is False)
    if losing_admin and crud.count_active_admins(db) <= 1:
        raise HTTPException(status_code=400, detail="There must be at least one active admin.")

    if payload.role is not None and payload.role != target.role:
        crud.audit(db, "admin.role_change", actor=admin, target=target,
                   detail="{} -> {}".format(target.role, payload.role), commit=False)
        target.role = payload.role
    if payload.is_active is not None and payload.is_active != target.is_active:
        crud.audit(db, "admin.enable" if payload.is_active else "admin.disable", actor=admin, target=target,
                   commit=False)
        target.is_active = payload.is_active
        if not payload.is_active:
            target.token_version += 1       # kicks them out of every device immediately
    db.commit()
    return _row(target, _load_world(db), resolve_today(None))


@router.post("/users/{user_id}/force-logout")
def force_logout(user_id: int, admin: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    target = _get_target(db, user_id)
    target.token_version += 1
    db.commit()
    crud.audit(db, "admin.force_logout", actor=admin, target=target)
    return {"ok": True}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, admin: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    target = _get_target(db, user_id)
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="You can't delete your own account here.")
    if target.role == "admin":
        raise HTTPException(status_code=400, detail="Change this admin to a regular user before deleting.")
    crud.audit(db, "admin.delete_user", actor=admin, target=target, detail="Account and all its data deleted")
    crud.delete_user_and_data(db, target.id)
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

def _audit_out(a: models.AuditLog) -> dict:
    return {"id": a.id, "at": _iso(a.created_at), "action": a.action,
            "actor_id": a.actor_id, "actor_email": a.actor_email,
            "target_id": a.target_id, "target_email": a.target_email, "detail": a.detail}


@router.get("/audit")
def audit_log(action: str = Query(default="", max_length=50), page: int = Query(default=1, ge=1),
              page_size: int = Query(default=30, ge=1, le=100), db: Session = Depends(get_db)):
    query = db.query(models.AuditLog)
    if action:
        query = query.filter(models.AuditLog.action.like(action.replace("%", "") + "%"))
    total = query.count()
    rows = query.order_by(models.AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "page": page, "page_size": page_size, "items": [_audit_out(a) for a in rows]}
