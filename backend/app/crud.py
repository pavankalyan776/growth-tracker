"""Data-access layer: plain reads/writes against the database. No game rules in here.

Every function that touches tracker data takes the user's id, and every query filters by it.
That filter is what keeps one hunter's data invisible to another.
"""
from datetime import date
from typing import List, Optional, Set

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models, schemas
from .models import utcnow
from .seed_data import TEMPLATES

# ---------- Users ----------


def get_user(db: Session, user_id: int) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email.strip().lower()).first()


def create_user(db: Session, email: str, name: str, password_hash: str, role: str = "user",
                onboarded: bool = False) -> models.User:
    user = models.User(email=email.strip().lower(), name=name, password_hash=password_hash,
                       role=role, onboarded=onboarded)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def count_active_admins(db: Session) -> int:
    return (db.query(models.User)
            .filter(models.User.role == "admin", models.User.is_active == True)  # noqa: E712
            .count())


def delete_user_and_data(db: Session, user_id: int) -> None:
    """Remove a user and everything they own. Explicit so it behaves the same on SQLite and MySQL."""
    for model in (models.Completion, models.Journal, models.CoinTransaction, models.Shield,
                  models.Purchase, models.MilestoneAchieved, models.DareDone, models.Quest):
        db.query(model).filter(model.user_id == user_id).delete(synchronize_session=False)
    db.query(models.User).filter(models.User.id == user_id).delete(synchronize_session=False)
    db.commit()


# ---------- Audit ----------

def audit(db: Session, action: str, actor: Optional[models.User] = None,
          target: Optional[models.User] = None, detail: str = "", commit: bool = True) -> None:
    db.add(models.AuditLog(
        action=action,
        actor_id=actor.id if actor else None, actor_email=actor.email if actor else None,
        target_id=target.id if target else None, target_email=target.email if target else None,
        detail=detail[:300],
    ))
    if commit:
        db.commit()


# ---------- Onboarding / seeding ----------

def seed_quests(db: Session, user_id: int, template: str) -> None:
    for q in TEMPLATES[template]["quests"]:
        db.add(models.Quest(user_id=user_id, **q))
    db.commit()


# ---------- Quests (full CRUD) ----------

def get_quests(db: Session, user_id: int, day_type: Optional[str] = None) -> List[models.Quest]:
    q = db.query(models.Quest).filter(models.Quest.user_id == user_id)
    if day_type:
        q = q.filter(models.Quest.day_type == day_type)
    return q.order_by(models.Quest.day_type, models.Quest.sort_order, models.Quest.id).all()


def get_quest(db: Session, user_id: int, quest_id: int) -> Optional[models.Quest]:
    return (db.query(models.Quest)
            .filter(models.Quest.id == quest_id, models.Quest.user_id == user_id).first())


def create_quest(db: Session, user_id: int, quest: schemas.QuestCreate) -> models.Quest:
    max_order = (
        db.query(func.max(models.Quest.sort_order))
        .filter(models.Quest.user_id == user_id, models.Quest.day_type == quest.day_type)
        .scalar()
    ) or 0
    db_quest = models.Quest(user_id=user_id, **quest.model_dump(), sort_order=max_order + 1)
    db.add(db_quest)
    db.commit()
    db.refresh(db_quest)
    return db_quest


def update_quest(db: Session, user_id: int, quest_id: int, patch: schemas.QuestUpdate) -> Optional[models.Quest]:
    db_quest = get_quest(db, user_id, quest_id)
    if not db_quest:
        return None
    for field, value in patch.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(db_quest, field, value)
    db.commit()
    db.refresh(db_quest)
    return db_quest


def delete_quest(db: Session, user_id: int, quest_id: int) -> bool:
    db_quest = get_quest(db, user_id, quest_id)
    if not db_quest:
        return False
    db.query(models.Completion).filter(
        models.Completion.user_id == user_id, models.Completion.quest_id == quest_id
    ).delete(synchronize_session=False)
    db.delete(db_quest)
    db.commit()
    return True


# ---------- Completions ----------

def set_completion(db: Session, user_id: int, quest_id: int, on: date, completed: bool) -> None:
    row = (
        db.query(models.Completion)
        .filter(models.Completion.user_id == user_id, models.Completion.quest_id == quest_id,
                models.Completion.date == on)
        .first()
    )
    if completed and not row:
        db.add(models.Completion(user_id=user_id, quest_id=quest_id, date=on, completed=True))
    elif not completed and row:
        db.delete(row)
    db.commit()


# ---------- Daily dares ----------

def set_dare(db: Session, user_id: int, on: date, done: bool) -> None:
    row = db.query(models.DareDone).filter(models.DareDone.user_id == user_id, models.DareDone.date == on).first()
    if done and not row:
        db.add(models.DareDone(user_id=user_id, date=on))
    elif not done and row:
        db.delete(row)
    db.commit()


# ---------- Shields ----------

def add_shield(db: Session, user_id: int, on: date) -> bool:
    if db.query(models.Shield).filter(models.Shield.user_id == user_id, models.Shield.date == on).first():
        return False
    db.add(models.Shield(user_id=user_id, date=on))
    db.commit()
    return True


# ---------- Journal (full CRUD) ----------

def get_journal(db: Session, user_id: int, on: date) -> Optional[models.Journal]:
    return (db.query(models.Journal)
            .filter(models.Journal.user_id == user_id, models.Journal.date == on).first())


def upsert_journal(db: Session, user_id: int, on: date, data: schemas.JournalIn) -> models.Journal:
    row = get_journal(db, user_id, on)
    if not row:
        row = models.Journal(user_id=user_id, date=on)
        db.add(row)
    row.mood = data.mood
    row.note = data.note.strip()
    row.struggle = data.struggle.strip()
    db.commit()
    db.refresh(row)
    return row


def delete_journal(db: Session, user_id: int, on: date) -> bool:
    row = get_journal(db, user_id, on)
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


def list_journal(db: Session, user_id: int, limit: int = 30) -> List[models.Journal]:
    return (db.query(models.Journal).filter(models.Journal.user_id == user_id)
            .order_by(models.Journal.date.desc()).limit(limit).all())


# ---------- Coins ----------

def coin_balance(db: Session, user_id: int) -> int:
    return int(db.query(func.coalesce(func.sum(models.CoinTransaction.amount), 0))
               .filter(models.CoinTransaction.user_id == user_id).scalar() or 0)


def add_coin_tx(db: Session, user_id: int, on: date, amount: int, reason: str, commit: bool = True) -> None:
    db.add(models.CoinTransaction(user_id=user_id, date=on, amount=amount, reason=reason))
    if commit:
        db.commit()


# ---------- Shop ----------

def owned_item_keys(db: Session, user_id: int) -> Set[str]:
    return {p.item_key for p in db.query(models.Purchase).filter(models.Purchase.user_id == user_id).all()}


def add_purchase(db: Session, user_id: int, key: str, cost: int) -> None:
    db.add(models.Purchase(user_id=user_id, item_key=key, cost=cost))
    db.commit()


def touch_active(db: Session, user: models.User) -> None:
    user.last_active_at = utcnow()
    db.commit()
