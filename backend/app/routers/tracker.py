"""Everything a signed-in hunter does with their OWN data. Each query is filtered by user.id."""
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, game_logic, models, schemas
from ..database import get_db
from ..deps import require_onboarded, resolve_today
from ..shop import DEFAULT_THEME, DEFAULT_TITLE, ITEMS_BY_KEY, SHOP_ITEMS

router = APIRouter(prefix="/api", tags=["tracker"])


def _snap(db: Session, user: models.User) -> game_logic.Snapshot:
    return game_logic.Snapshot.load(db, user)


def _rewards(db: Session, user: models.User, today: date, snap: Optional[game_logic.Snapshot] = None) -> List[dict]:
    """Re-check every coin reward after any change. Returns what was newly granted."""
    return game_logic.reconcile(db, snap or _snap(db, user), user, today)


def _finish_write(db: Session, user: models.User, today: date, snap: game_logic.Snapshot,
                  before: dict, on: Optional[date] = None, was_perfect: bool = False) -> dict:
    """Everything the screen needs after a change, in ONE response: new totals, rewards, the fresh overview
    and (for a day) the fresh day. The browser applies it and makes no follow-up requests."""
    after = game_logic.compute_progress(snap, today)
    events = game_logic.reconcile(db, snap, user, today)
    out = {
        "ok": True, "events": events,
        "xp_delta": after["total_xp"] - before["total_xp"],
        "level_up": after["level"] > before["level"],
        "rank_up": after["rank"] != before["rank"] and after["level"] > before["level"],
        "rank": after["rank"], "level": after["level"],
        "overview": game_logic.build_overview(db, snap, user, today),
    }
    if on is not None:
        out["day_cleared"] = snap.is_perfect(on) and not was_perfect
        out["day"] = game_logic.build_day(snap, on, today, journal=crud.get_journal(db, user.id, on))
    return out


# ---------------------------------------------------------------------------
# Overview: everything the hunter card + dashboard needs, in one call
# ---------------------------------------------------------------------------

@router.get("/overview")
def get_overview(today: date = Depends(resolve_today), user: models.User = Depends(require_onboarded),
                 db: Session = Depends(get_db)):
    snap = _snap(db, user)
    events = _rewards(db, user, today, snap)
    data = game_logic.build_overview(db, snap, user, today)
    data["events"] = events
    return data


# ---------------------------------------------------------------------------
# Days & completions
# ---------------------------------------------------------------------------

@router.get("/day/{the_date}")
def get_day(the_date: date, today: date = Depends(resolve_today),
            user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    return game_logic.build_day(_snap(db, user), the_date, today, journal=crud.get_journal(db, user.id, the_date))


@router.post("/completions/toggle")
def toggle_completion(payload: schemas.CompletionToggle, today: date = Depends(resolve_today),
                      user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    snap = _snap(db, user)
    if not snap.in_plan(payload.date):
        raise HTTPException(status_code=400, detail="That date is outside your plan.")
    if payload.date > today:
        raise HTTPException(status_code=400, detail="You can't clear tasks for a future day.")
    quest = snap.quest_by_id.get(payload.quest_id)
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    if quest.day_type != game_logic.day_type(payload.date):
        raise HTTPException(status_code=400, detail="That task doesn't belong to this day.")
    before = dict(game_logic.compute_progress(snap, today))
    was_perfect = snap.is_perfect(payload.date)
    crud.set_completion(db, user.id, payload.quest_id, payload.date, payload.completed)
    snap.apply_completion(payload.quest_id, payload.date, payload.completed)
    return _finish_write(db, user, today, snap, before, payload.date, was_perfect)


@router.post("/dares/toggle")
def toggle_dare(payload: schemas.DareToggle, today: date = Depends(resolve_today),
                user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    snap = _snap(db, user)
    if not snap.in_plan(payload.date):
        raise HTTPException(status_code=400, detail="That date is outside your plan.")
    if payload.date > today:
        raise HTTPException(status_code=400, detail="You can't finish a dare for a future day.")
    before = dict(game_logic.compute_progress(snap, today))
    was_perfect = snap.is_perfect(payload.date)
    key = snap.dare_for_day(payload.date)["key"]
    crud.set_dare(db, user.id, payload.date, payload.completed, key)
    snap.apply_dare(payload.date, payload.completed, key)
    return _finish_write(db, user, today, snap, before, payload.date, was_perfect)


@router.get("/board")
def get_board(today: date = Depends(resolve_today), user: models.User = Depends(require_onboarded),
              db: Session = Depends(get_db)):
    return game_logic.build_board(db, user, today)


# ---------------------------------------------------------------------------
# Challenges a member builds themselves (a form, no code)
# ---------------------------------------------------------------------------

def _challenge_or_404(db: Session, user: models.User, challenge_id: int) -> models.Challenge:
    row = crud.get_challenge(db, user.id, challenge_id)
    if not row:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return row


def _state(snap: game_logic.Snapshot, today: date, challenge_id: int) -> dict:
    return next(c for c in snap.challenge_states(today) if c["id"] == challenge_id)


@router.get("/challenges")
def list_challenges(today: date = Depends(resolve_today), user: models.User = Depends(require_onboarded),
                    db: Session = Depends(get_db)):
    snap = _snap(db, user)
    return {"items": list(reversed(snap.challenge_states(today))), "max_active": game_logic.CHALLENGE_MAX_ACTIVE,
            "reward": {"xp": game_logic.CHALLENGE_XP, "coins": game_logic.CHALLENGE_COINS,
                       "weekly_cap": game_logic.CHALLENGE_WEEKLY_CAP}}


@router.post("/challenges", status_code=201)
def create_challenge(payload: schemas.ChallengeIn, today: date = Depends(resolve_today),
                     user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    snap = _snap(db, user)
    start = payload.start_date or today
    end = start + timedelta(days=payload.days - 1)
    if payload.target > payload.days:
        raise HTTPException(status_code=400, detail="You can't need more check-ins than there are days.")
    if start < today or start > today + timedelta(days=30):
        raise HTTPException(status_code=400, detail="A challenge starts today or within the next 30 days.")
    if not snap.in_plan(start) or end > snap.end:
        raise HTTPException(status_code=400, detail="That challenge would run past your plan. Shorten it or extend your plan.")
    live = sum(1 for c in snap.challenge_states(today) if c["status"] in ("active", "upcoming"))
    if live >= game_logic.CHALLENGE_MAX_ACTIVE:
        raise HTTPException(status_code=400, detail="You already have {} live challenges. Finish or archive one first."
                            .format(game_logic.CHALLENGE_MAX_ACTIVE))
    row = models.Challenge(user_id=user.id, title=payload.title, emoji=payload.emoji or "🎯", target=payload.target,
                           start_date=start, end_date=end)
    db.add(row)
    db.commit()
    snap = _snap(db, user)
    return {"ok": True, "challenge": _state(snap, today, row.id), "overview": game_logic.build_overview(db, snap, user, today)}


@router.post("/challenges/{challenge_id}/checkin")
def checkin_challenge(challenge_id: int, payload: schemas.ChallengeCheckinIn, today: date = Depends(resolve_today),
                      user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    row = _challenge_or_404(db, user, challenge_id)
    if row.archived:
        raise HTTPException(status_code=400, detail="That challenge is archived.")
    if payload.date < row.start_date or payload.date > row.end_date:
        raise HTTPException(status_code=400, detail="That date is outside this challenge.")
    if payload.date > today:
        raise HTTPException(status_code=400, detail="You can't check in for a future day.")
    snap = _snap(db, user)
    state = _state(snap, today, challenge_id)
    already = payload.date in snap.checkins.get(challenge_id, [])
    if payload.done and not already and state["status"] == "done":
        raise HTTPException(status_code=400, detail="You already finished this one. Nice work.")
    before = dict(game_logic.compute_progress(snap, today))
    crud.set_checkin(db, user.id, challenge_id, payload.date, payload.done)
    snap.apply_checkin(challenge_id, payload.date, payload.done)
    out = _finish_write(db, user, today, snap, before)
    out["challenge"] = _state(snap, today, challenge_id)
    return out


@router.patch("/challenges/{challenge_id}")
def patch_challenge(challenge_id: int, payload: schemas.ChallengePatch, today: date = Depends(resolve_today),
                    user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    row = _challenge_or_404(db, user, challenge_id)
    if payload.archived is None:
        raise HTTPException(status_code=400, detail="Nothing to change.")
    row.archived = payload.archived
    db.commit()
    snap = _snap(db, user)
    return {"ok": True, "challenge": _state(snap, today, challenge_id),
            "overview": game_logic.build_overview(db, snap, user, today)}


@router.delete("/challenges/{challenge_id}")
def delete_challenge(challenge_id: int, today: date = Depends(resolve_today),
                     user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    _challenge_or_404(db, user, challenge_id)
    snap = _snap(db, user)
    if _state(snap, today, challenge_id)["completed_on"]:
        raise HTTPException(status_code=400, detail="Finished challenges can be archived, not deleted, so your points stay.")
    crud.delete_challenge(db, user.id, challenge_id)
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Quests: full CRUD
# ---------------------------------------------------------------------------

@router.get("/quests", response_model=List[schemas.QuestOut])
def list_quests(day_type: Optional[str] = None, user: models.User = Depends(require_onboarded),
                db: Session = Depends(get_db)):
    return crud.get_quests(db, user.id, day_type)


@router.post("/quests", response_model=schemas.QuestOut, status_code=201)
def create_quest(quest: schemas.QuestCreate, user: models.User = Depends(require_onboarded),
                 db: Session = Depends(get_db)):
    if len(crud.get_quests(db, user.id, quest.day_type)) >= 20:
        raise HTTPException(status_code=400, detail="That's 20 quests for one day type. Trim some first.")
    return crud.create_quest(db, user.id, quest)


@router.put("/quests/{quest_id}", response_model=schemas.QuestOut)
def update_quest(quest_id: int, patch: schemas.QuestUpdate, user: models.User = Depends(require_onboarded),
                 db: Session = Depends(get_db)):
    updated = crud.update_quest(db, user.id, quest_id, patch)
    if not updated:
        raise HTTPException(status_code=404, detail="Quest not found")
    return updated


@router.delete("/quests/{quest_id}")
def delete_quest(quest_id: int, user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    if not crud.delete_quest(db, user.id, quest_id):
        raise HTTPException(status_code=404, detail="Quest not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Calendar, heatmap, analytics (read-only views)
# ---------------------------------------------------------------------------

@router.get("/calendar")
def get_calendar(month: str, today: date = Depends(resolve_today),
                 user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    try:
        year, mon = (int(x) for x in month.split("-"))
        date(year, mon, 1)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="month must look like 2026-10")
    return game_logic.build_calendar(_snap(db, user), year, mon, today)


@router.get("/heatmap")
def get_heatmap(today: date = Depends(resolve_today), user: models.User = Depends(require_onboarded),
                db: Session = Depends(get_db)):
    return game_logic.build_heatmap(_snap(db, user), today)


@router.get("/analytics")
def get_analytics(today: date = Depends(resolve_today), user: models.User = Depends(require_onboarded),
                  db: Session = Depends(get_db)):
    struggles = {d: t for d, t in db.query(models.Journal.date, models.Journal.struggle).filter(
        models.Journal.user_id == user.id, models.Journal.struggle != "").all()}
    return game_logic.build_analytics(_snap(db, user), today, struggles)


# ---------------------------------------------------------------------------
# Milestones
# ---------------------------------------------------------------------------

@router.get("/milestones", response_model=List[schemas.MilestoneOut])
def get_milestones(user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    achieved = {m.milestone_key: m.achieved_at for m in
                db.query(models.MilestoneAchieved).filter(models.MilestoneAchieved.user_id == user.id).all()}
    return [
        schemas.MilestoneOut(id=m["id"], title=m["title"], desc=m["desc"], reward=m["reward"],
                             achieved=m["id"] in achieved, achieved_at=achieved.get(m["id"]), calm=m.get("calm"),
                             emoji=m.get("emoji", "🏆"))
        for m in game_logic.MILESTONE_DEFS
    ]


# ---------------------------------------------------------------------------
# Streak shields (spend coins to repair a missed day)
# ---------------------------------------------------------------------------

@router.post("/shields")
def use_shield(payload: schemas.ShieldRequest, today: date = Depends(resolve_today),
               user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    snap = _snap(db, user)
    d = payload.date
    if not snap.in_plan(d) or d >= today:
        raise HTTPException(status_code=400, detail="Only past days inside your plan can be shielded.")
    if not snap.tasks(d):
        raise HTTPException(status_code=400, detail="There were no quests that day.")
    if snap.is_good(d):
        raise HTTPException(status_code=400, detail="That day already counts toward your streak.")
    if crud.coin_balance(db, user.id) < game_logic.SHIELD_COST:
        raise HTTPException(status_code=400, detail="Not enough coins for a shield.")
    if not crud.add_shield(db, user.id, d):
        raise HTTPException(status_code=400, detail="Already shielded.")
    crud.add_coin_tx(db, user.id, today, -game_logic.SHIELD_COST, "Streak Shield on {}".format(d.isoformat()))
    snap.shields.add(d)
    snap._changed(d)
    return {"ok": True, "events": _rewards(db, user, today, snap),
            "overview": game_logic.build_overview(db, snap, user, today),
            "day": game_logic.build_day(snap, d, today, journal=crud.get_journal(db, user.id, d))}


@router.get("/shields")
def list_shields(user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    return sorted(s.date.isoformat() for s in
                  db.query(models.Shield).filter(models.Shield.user_id == user.id).all())


# ---------------------------------------------------------------------------
# Journal: full CRUD (the "pain, failure, growth" log). Private: admins can't read it.
# ---------------------------------------------------------------------------

def _j(row: models.Journal) -> dict:
    return {"date": row.date.isoformat(), "mood": row.mood, "note": row.note, "struggle": row.struggle}


@router.get("/journal")
def list_journal(limit: int = 30, user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    return [_j(r) for r in crud.list_journal(db, user.id, max(1, min(limit, 200)))]


@router.get("/journal/{the_date}")
def get_journal(the_date: date, user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    row = crud.get_journal(db, user.id, the_date)
    if not row:
        raise HTTPException(status_code=404, detail="No entry for that day")
    return _j(row)


@router.put("/journal/{the_date}")
def put_journal(the_date: date, payload: schemas.JournalIn, today: date = Depends(resolve_today),
                user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    if not (user.plan_start <= the_date <= user.plan_end) or the_date > today:
        raise HTTPException(status_code=400, detail="Journal entries are for days that have started.")
    row = crud.upsert_journal(db, user.id, the_date, payload)
    out = _j(row)
    snap = _snap(db, user)
    out["events"] = _rewards(db, user, today, snap)
    return out


@router.delete("/journal/{the_date}")
def delete_journal(the_date: date, user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    if not crud.delete_journal(db, user.id, the_date):
        raise HTTPException(status_code=404, detail="No entry for that day")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Shop (virtual cosmetics only)
# ---------------------------------------------------------------------------

def _shop_state(db: Session, user: models.User) -> dict:
    owned = crud.owned_item_keys(db, user.id) | {DEFAULT_TITLE, DEFAULT_THEME}
    equipped = {user.title_key, user.theme_key}
    return {
        "coins": crud.coin_balance(db, user.id),
        "items": [dict(item, owned=item["key"] in owned, equipped=item["key"] in equipped)
                  for item in SHOP_ITEMS],
    }


@router.get("/shop")
def get_shop(user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    return _shop_state(db, user)


@router.post("/shop/buy")
def buy_item(payload: schemas.ShopAction, today: date = Depends(resolve_today),
             user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    item = ITEMS_BY_KEY.get(payload.key)
    if not item:
        raise HTTPException(status_code=404, detail="Unknown item")
    if item["key"] in crud.owned_item_keys(db, user.id) or item["cost"] == 0:
        raise HTTPException(status_code=400, detail="You already own that.")
    if crud.coin_balance(db, user.id) < item["cost"]:
        raise HTTPException(status_code=400, detail="Not enough coins.")
    crud.add_coin_tx(db, user.id, today, -item["cost"], "Shop: " + item["label"])
    crud.add_purchase(db, user.id, item["key"], item["cost"])
    return _shop_state(db, user)


@router.post("/shop/equip")
def equip_item(payload: schemas.ShopAction, user: models.User = Depends(require_onboarded),
               db: Session = Depends(get_db)):
    item = ITEMS_BY_KEY.get(payload.key)
    if not item:
        raise HTTPException(status_code=404, detail="Unknown item")
    if item["cost"] > 0 and item["key"] not in crud.owned_item_keys(db, user.id):
        raise HTTPException(status_code=400, detail="Buy it first.")
    if item["kind"] == "title":
        user.title_key = item["key"]
    else:
        user.theme_key = item["key"]
    db.commit()
    return _shop_state(db, user)


# ---------------------------------------------------------------------------
# Export (your own data, as a JSON backup)
# ---------------------------------------------------------------------------

@router.get("/export")
def export_everything(user: models.User = Depends(require_onboarded), db: Session = Depends(get_db)):
    uid = user.id
    return {
        "exported_for": "growth-tracker v5",
        "hunter": {"name": user.name, "email": user.email,
                   "plan_start": user.plan_start.isoformat(), "plan_end": user.plan_end.isoformat()},
        "quests": [schemas.QuestOut.model_validate(q).model_dump() for q in crud.get_quests(db, uid)],
        "completions": [{"quest_id": c.quest_id, "date": c.date.isoformat()} for c in
                        db.query(models.Completion).filter(models.Completion.user_id == uid)
                        .order_by(models.Completion.date).all()],
        "shields": sorted(s.date.isoformat() for s in
                          db.query(models.Shield).filter(models.Shield.user_id == uid).all()),
        "dares_done": sorted(r.date.isoformat() for r in
                             db.query(models.DareDone).filter(models.DareDone.user_id == uid).all()),
        "challenges": [{"title": c.title, "emoji": c.emoji, "target": c.target, "start": c.start_date.isoformat(),
                        "end": c.end_date.isoformat(), "archived": c.archived,
                        "checkins": sorted(k.date.isoformat() for k in db.query(models.ChallengeCheckin)
                                           .filter(models.ChallengeCheckin.challenge_id == c.id).all())}
                       for c in db.query(models.Challenge).filter(models.Challenge.user_id == uid).all()],
        "journal": [_j(j) for j in db.query(models.Journal).filter(models.Journal.user_id == uid)
                    .order_by(models.Journal.date).all()],
        "coin_transactions": [{"date": t.date.isoformat(), "amount": t.amount, "reason": t.reason} for t in
                              db.query(models.CoinTransaction).filter(models.CoinTransaction.user_id == uid)
                              .order_by(models.CoinTransaction.id).all()],
        "milestones": [m.milestone_key for m in
                       db.query(models.MilestoneAchieved).filter(models.MilestoneAchieved.user_id == uid).all()],
        "purchases": sorted(crud.owned_item_keys(db, uid)),
    }
