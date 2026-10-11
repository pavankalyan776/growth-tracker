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

from .. import cache, crud, game_logic, models, schemas
from ..database import get_db
from ..deps import require_admin, resolve_today
from ..models import utcnow

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])

SORTS = {"joined", "active", "level", "streak", "completion", "name"}


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() + "Z" if dt else None


# ---------------------------------------------------------------------------
# Bulk loading: a handful of queries for ALL users, then pure-Python maths. The finished numbers are plain
# data (no database objects), cached for a few seconds, so refreshing admin pages never recomputes the world.
# (Fine for hundreds of users. At thousands, move these rollups into SQL or a nightly job.)
# ---------------------------------------------------------------------------

class _Q:
    """The few quest fields the rules read, copied out so nothing here depends on an open database session."""
    __slots__ = ("id", "day_type", "sort_order", "stat", "label")

    def __init__(self, row):
        self.id, self.day_type, self.sort_order, self.stat, self.label = (
            row.id, row.day_type, row.sort_order, row.stat, row.label)


def _compute_world(db: Session, today: date) -> Dict[str, Any]:
    """Rolled-up numbers for MEMBERS. Admin accounts are not members: their own activity is left out of every total."""
    users = db.query(models.User).filter(models.User.role == "user").all()
    member_ids = {u.id for u in users}
    quests, comps, shields, dares, journal = (defaultdict(list), defaultdict(list), defaultdict(list),
                                              defaultdict(list), defaultdict(dict))
    for q in db.query(models.Quest).all():
        if q.user_id in member_ids:
            quests[q.user_id].append(_Q(q))
    active_by_day: Dict[date, set] = defaultdict(set)
    count_by_day: Dict[date, int] = defaultdict(int)
    for uid, qid, d in db.query(models.Completion.user_id, models.Completion.quest_id,
                                models.Completion.date).filter(models.Completion.completed == True).all():  # noqa: E712
        if uid not in member_ids:
            continue
        comps[uid].append((qid, d))
        active_by_day[d].add(uid)
        count_by_day[d] += 1
    for uid, d in db.query(models.Shield.user_id, models.Shield.date).all():
        if uid in member_ids:
            shields[uid].append(d)
    for uid, d in db.query(models.DareDone.user_id, models.DareDone.date).all():
        if uid in member_ids:
            dares[uid].append(d)
    # Only the DATE of each journal entry is loaded. The text never leaves the database here.
    for uid, d in db.query(models.Journal.user_id, models.Journal.date).all():
        if uid in member_ids:
            journal[uid][d] = True
    challenges, checkins = defaultdict(list), defaultdict(lambda: defaultdict(list))
    for c in db.query(models.Challenge).all():
        if c.user_id in member_ids:
            challenges[c.user_id].append(c)
    for uid, cid, d in db.query(models.ChallengeCheckin.user_id, models.ChallengeCheckin.challenge_id,
                                models.ChallengeCheckin.date).all():
        if uid in member_ids:
            checkins[uid][cid].append(d)
    custom = db.query(models.CustomDare).all()

    stats: Dict[int, Optional[dict]] = {}
    for u in users:
        if u.onboarded and u.plan_start:
            snap = game_logic.Snapshot(u.plan_start, u.plan_end, quests.get(u.id, []), comps.get(u.id, []),
                                       shields.get(u.id, []), journal.get(u.id, {}), dares.get(u.id, []), u.id,
                                       None, custom, challenges.get(u.id, []), checkins.get(u.id))
            stats[u.id] = game_logic.summarize(snap, today)
        else:
            stats[u.id] = None
    return {
        "stats": stats, "has_completion": {uid for uid, v in comps.items() if v},
        "active_by_day": {d: len(v) for d, v in active_by_day.items()}, "count_by_day": dict(count_by_day),
        "quests_cleared": sum(len(v) for v in comps.values()),
        "dares_done": sum(len(v) for v in dares.values()),
        "challenges_built": sum(len(v) for v in challenges.values()),
    }


def _world(db: Session, today: date) -> Dict[str, Any]:
    return cache.get_or_set(("admin-world", today), lambda: _compute_world(db, today))


def _row(user: models.User, world: Dict[str, Any]) -> dict:
    return {
        "id": user.id, "email": user.email, "name": user.name, "role": user.role,
        "is_active": user.is_active, "onboarded": user.onboarded, "avatar": user.avatar,
        "created_at": _iso(user.created_at), "last_login_at": _iso(user.last_login_at),
        "last_active_at": _iso(user.last_active_at),
        "stats": world["stats"].get(user.id),
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
    users = (db.query(models.User.id, models.User.created_at, models.User.last_active_at, models.User.is_active,
                      models.User.role, models.User.onboarded).filter(models.User.role == "user").all())
    admin_count = db.query(models.User).filter(models.User.role == "admin").count()
    world = _world(db, today)
    now = utcnow()

    with_stats = [s for s in world["stats"].values() if s and s["tracked_days"] > 0]

    def active_since(days: int) -> int:
        cutoff = now - timedelta(days=days)
        return sum(1 for u in users if u.last_active_at and u.last_active_at >= cutoff)

    signups = defaultdict(int)
    for u in users:
        signups[u.created_at.date()] += 1
    window = [today - timedelta(days=i) for i in range(29, -1, -1)]
    series = [{"date": d.isoformat(), "signups": signups.get(d, 0),
               "active_members": world["active_by_day"].get(d, 0),
               "tasks_done": world["count_by_day"].get(d, 0)} for d in window]

    rank_dist = {r: 0 for r, _ in game_logic.RANKS}
    for s in with_stats:
        rank_dist[s["rank"]] += 1

    funnel = [
        {"step": "Registered", "count": len(users)},
        {"step": "Set up a plan", "count": sum(1 for u in users if u.onboarded)},
        {"step": "Finished a task", "count": sum(1 for u in users if u.id in world["has_completion"])},
        {"step": "3-day streak", "count": sum(1 for s in with_stats if s["longest_streak"] >= 3)},
        {"step": "7-day streak", "count": sum(1 for s in with_stats if s["longest_streak"] >= 7)},
    ]

    recent = (db.query(models.AuditLog).order_by(models.AuditLog.id.desc()).limit(8).all())
    return {
        "totals": {
            "users": len(users),
            "active_accounts": sum(1 for u in users if u.is_active),
            "disabled": sum(1 for u in users if not u.is_active),
            "admins": admin_count,
            "onboarded": sum(1 for u in users if u.onboarded),
            "new_7d": sum(1 for u in users if u.created_at >= now - timedelta(days=7)),
            "active_1d": active_since(1), "active_7d": active_since(7), "active_30d": active_since(30),
            "tasks_done": world["quests_cleared"], "dares_done": world["dares_done"],
            "challenges_built": world["challenges_built"],
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

STAT_SORTS = {"level", "streak", "completion"}


@router.get("/users")
def list_users(
    q: str = Query(default="", max_length=100),
    role: str = Query(default="user", pattern=r"^(user|admin|all)$"),
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
    if role != "all":
        query = query.filter(models.User.role == role)
    if status:
        query = query.filter(models.User.is_active == (status == "active"))
    total = query.count()
    world = _world(db, today)
    start = (page - 1) * page_size
    if sort in STAT_SORTS:
        # Progress numbers live in the cached rollup, so these three sorts are done in memory.
        users = query.all()
        field = {"level": "level", "streak": "current_streak", "completion": "avg_completion"}[sort]
        users.sort(key=lambda u: ((world["stats"].get(u.id) or {}).get(field, 0), u.id), reverse=(order == "desc"))
        users = users[start:start + page_size]
    else:
        column = {"joined": models.User.created_at, "active": models.User.last_active_at,
                  "name": func.lower(models.User.name)}[sort]
        users = (query.order_by(column.desc() if order == "desc" else column.asc(), models.User.id)
                 .offset(start).limit(page_size).all())
    return {"total": total, "page": page, "page_size": page_size, "items": [_row(u, world) for u in users]}


@router.get("/users/{user_id}")
def user_detail(user_id: int, admin: models.User = Depends(require_admin), today: date = Depends(resolve_today),
                db: Session = Depends(get_db)):
    target = _get_target(db, user_id)
    world = _world(db, today)
    row = _row(target, world)
    snap = game_logic.Snapshot.load(db, target) if target.onboarded and target.plan_start else None

    recent_days = []
    if snap and snap.has_plan:
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
    cache.clear()
    return _row(target, _world(db, resolve_today(None)))


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
    cache.clear()
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


# ---------------------------------------------------------------------------
# Content studio: the admin edits what members see, with forms instead of code.
# Dares, announcements and starting plans live in the database; the built-in ones are the seed.
# Every change is written to the audit log.
# ---------------------------------------------------------------------------

def _dare_out(r: models.CustomDare) -> dict:
    return {"id": r.id, "key": "c{}".format(r.id), "label": r.label, "hint": r.hint, "category": r.category,
            "emoji": r.emoji, "active": r.active, "custom": True,
            "created_at": _iso(r.created_at)}


def _dare_row(db: Session, dare_id: int) -> models.CustomDare:
    row = db.query(models.CustomDare).filter(models.CustomDare.id == dare_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Dare not found")
    return row


@router.get("/content/dares")
def list_dares(db: Session = Depends(get_db)):
    from ..dares import DARES, CATEGORY_EMOJI
    custom = db.query(models.CustomDare).order_by(models.CustomDare.id.desc()).all()
    return {"builtin": [dict(d, custom=False, active=True) for d in DARES],
            "custom": [_dare_out(r) for r in custom], "categories": CATEGORY_EMOJI}


@router.post("/content/dares", status_code=201)
def add_dare(payload: schemas.DareIn, admin: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(models.CustomDare).count() >= 200:
        raise HTTPException(status_code=400, detail="That's 200 custom dares. Hide or delete some first.")
    row = models.CustomDare(label=payload.label, hint=payload.hint, category=payload.category,
                            emoji=payload.emoji or "✨", active=payload.active)
    db.add(row)
    db.commit()
    crud.audit(db, "content.dare_add", actor=admin, detail=row.label[:120])
    cache.clear()
    return _dare_out(row)


@router.patch("/content/dares/{dare_id}")
def edit_dare(dare_id: int, payload: schemas.DarePatch, admin: models.User = Depends(require_admin),
              db: Session = Depends(get_db)):
    row = _dare_row(db, dare_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to change.")
    for field, value in changes.items():
        if value is not None:
            setattr(row, field, value)
    db.commit()
    crud.audit(db, "content.dare_edit", actor=admin, detail="{}: {}".format(row.id, ", ".join(sorted(changes))))
    return _dare_out(row)


@router.delete("/content/dares/{dare_id}")
def delete_dare(dare_id: int, admin: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    row = _dare_row(db, dare_id)
    used = db.query(models.DareDone).filter(models.DareDone.dare_key == "c{}".format(row.id)).first()
    if used:
        raise HTTPException(status_code=409, detail="Members have already finished this dare. Hide it instead.")
    crud.audit(db, "content.dare_delete", actor=admin, detail=row.label[:120], commit=False)
    db.delete(row)
    db.commit()
    return {"deleted": True}


# ---- announcements ----

@router.get("/content/announcements")
def list_announcements(db: Session = Depends(get_db)):
    rows = db.query(models.Announcement).order_by(models.Announcement.id.desc()).limit(100).all()
    return [crud.announcement_out(a) for a in rows]


@router.post("/content/announcements", status_code=201)
def add_announcement(payload: schemas.AnnouncementIn, admin: models.User = Depends(require_admin),
                     db: Session = Depends(get_db)):
    row = models.Announcement(title=payload.title, body=payload.body, emoji=payload.emoji or "📣", tone=payload.tone,
                              active=payload.active, expires_on=payload.expires_on)
    db.add(row)
    db.commit()
    crud.audit(db, "content.announcement_add", actor=admin, detail=row.title[:120])
    return crud.announcement_out(row)


def _announcement(db: Session, ann_id: int) -> models.Announcement:
    row = db.query(models.Announcement).filter(models.Announcement.id == ann_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return row


@router.patch("/content/announcements/{ann_id}")
def edit_announcement(ann_id: int, payload: schemas.AnnouncementPatch, admin: models.User = Depends(require_admin),
                      db: Session = Depends(get_db)):
    row = _announcement(db, ann_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to change.")
    clear = changes.pop("clear_expiry", False)
    for field, value in changes.items():
        if value is not None:
            setattr(row, field, value)
    if clear:
        row.expires_on = None
    db.commit()
    crud.audit(db, "content.announcement_edit", actor=admin, detail="{}: {}".format(row.id, row.title[:80]))
    return crud.announcement_out(row)


@router.delete("/content/announcements/{ann_id}")
def delete_announcement(ann_id: int, admin: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    row = _announcement(db, ann_id)
    crud.audit(db, "content.announcement_delete", actor=admin, detail=row.title[:120], commit=False)
    db.delete(row)
    db.commit()
    return {"deleted": True}


# ---- starting plans ----

def _template_out(t: models.PlanTemplate, full: bool = False) -> dict:
    import json
    quests = crud.template_quests(t)
    out = {"key": t.key, "label": t.label, "desc": t.desc, "emoji": t.emoji, "active": t.active,
           "builtin": t.builtin, "quests": len(quests)}
    if full:
        out["quest_list"] = quests
    return out


def _template(db: Session, key: str) -> models.PlanTemplate:
    row = crud.get_template(db, key, only_active=False)
    if not row:
        raise HTTPException(status_code=404, detail="Starting plan not found")
    return row


@router.get("/content/templates")
def admin_templates(db: Session = Depends(get_db)):
    return [_template_out(t, full=True) for t in crud.list_templates(db, only_active=False)]


@router.post("/content/templates", status_code=201)
def add_template(payload: schemas.TemplateIn, admin: models.User = Depends(require_admin),
                 db: Session = Depends(get_db)):
    import json
    if crud.get_template(db, payload.key, only_active=False):
        raise HTTPException(status_code=409, detail="A starting plan with that key already exists.")
    for dt in ("weekday", "saturday", "sunday"):
        if sum(1 for q in payload.quests if q.day_type == dt) > 20:
            raise HTTPException(status_code=400, detail="At most 20 tasks per day type.")
    order = (db.query(func.max(models.PlanTemplate.sort_order)).scalar() or 0) + 1
    row = models.PlanTemplate(key=payload.key, label=payload.label, desc=payload.desc, emoji=payload.emoji or "🌱",
                              active=payload.active, builtin=False, sort_order=order,
                              quests_json=json.dumps([q.model_dump() for q in payload.quests]))
    db.add(row)
    db.commit()
    crud.audit(db, "content.template_add", actor=admin, detail=row.key)
    return _template_out(row, full=True)


@router.patch("/content/templates/{key}")
def edit_template(key: str, payload: schemas.TemplatePatch, admin: models.User = Depends(require_admin),
                  db: Session = Depends(get_db)):
    import json
    row = _template(db, key)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to change.")
    if payload.quests is not None:
        for dt in ("weekday", "saturday", "sunday"):
            if sum(1 for q in payload.quests if q.day_type == dt) > 20:
                raise HTTPException(status_code=400, detail="At most 20 tasks per day type.")
        row.quests_json = json.dumps([q.model_dump() for q in payload.quests])
    for field in ("label", "desc", "emoji", "active"):
        if changes.get(field) is not None:
            setattr(row, field, changes[field])
    db.commit()
    crud.audit(db, "content.template_edit", actor=admin, detail="{}: {}".format(row.key, ", ".join(sorted(changes))))
    return _template_out(row, full=True)


@router.delete("/content/templates/{key}")
def delete_template(key: str, admin: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    row = _template(db, key)
    if row.builtin:
        raise HTTPException(status_code=400, detail="Built-in plans can be hidden but not deleted.")
    crud.audit(db, "content.template_delete", actor=admin, detail=row.key, commit=False)
    db.delete(row)
    db.commit()
    return {"deleted": True}
