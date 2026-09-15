from sqlalchemy.orm import Session
from sqlalchemy import and_
from . import models, schemas
from .seed_data import DEFAULT_QUESTS


def seed_quests_if_empty(db: Session):
    if db.query(models.Quest).count() == 0:
        for q in DEFAULT_QUESTS:
            db.add(models.Quest(**q))
        db.commit()


# ---------- Quests (full CRUD) ----------

def get_quests(db: Session, day_type: str | None = None):
    q = db.query(models.Quest)
    if day_type:
        q = q.filter(models.Quest.day_type == day_type)
    return q.order_by(models.Quest.day_type, models.Quest.sort_order).all()


def create_quest(db: Session, quest: schemas.QuestCreate):
    max_order = (
        db.query(models.Quest)
        .filter(models.Quest.day_type == quest.day_type)
        .count()
    )
    db_quest = models.Quest(**quest.model_dump(), sort_order=max_order + 1)
    db.add(db_quest)
    db.commit()
    db.refresh(db_quest)
    return db_quest


def update_quest(db: Session, quest_id: int, patch: schemas.QuestUpdate):
    db_quest = db.query(models.Quest).filter(models.Quest.id == quest_id).first()
    if not db_quest:
        return None
    for field, value in patch.model_dump(exclude_unset=True).items():
        setattr(db_quest, field, value)
    db.commit()
    db.refresh(db_quest)
    return db_quest


def delete_quest(db: Session, quest_id: int) -> bool:
    db_quest = db.query(models.Quest).filter(models.Quest.id == quest_id).first()
    if not db_quest:
        return False
    db.delete(db_quest)
    db.commit()
    return True


# ---------- Completions ----------

def toggle_completion(db: Session, quest_id: int, date_, completed: bool):
    row = (
        db.query(models.Completion)
        .filter(and_(models.Completion.quest_id == quest_id, models.Completion.date == date_))
        .first()
    )
    if completed:
        if row:
            row.completed = True
        else:
            row = models.Completion(quest_id=quest_id, date=date_, completed=True)
            db.add(row)
    else:
        if row:
            db.delete(row)
    db.commit()


def get_completions_in_range(db: Session, start, end):
    rows = (
        db.query(models.Completion)
        .filter(and_(models.Completion.date >= start, models.Completion.date <= end))
        .all()
    )
    result = {}
    for r in rows:
        result.setdefault(r.date.isoformat(), []).append(r.quest_id)
    return result


# ---------- Shields ----------

def add_shield(db: Session, date_):
    if db.query(models.Shield).filter(models.Shield.date == date_).first():
        return False
    db.add(models.Shield(date=date_))
    db.commit()
    return True


def get_shielded_dates(db: Session):
    return {s.date.isoformat() for s in db.query(models.Shield).all()}


# ---------- Settings ----------

def get_setting(db: Session, key: str, default: str = ""):
    row = db.query(models.Setting).filter(models.Setting.key == key).first()
    return row.value if row else default


def set_setting(db: Session, key: str, value: str):
    row = db.query(models.Setting).filter(models.Setting.key == key).first()
    if row:
        row.value = value
    else:
        row = models.Setting(key=key, value=value)
        db.add(row)
    db.commit()
