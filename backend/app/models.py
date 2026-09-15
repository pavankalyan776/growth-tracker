from sqlalchemy import (
    Column, Integer, String, Date, Boolean, ForeignKey, UniqueConstraint, DateTime
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Quest(Base):
    """A quest template — e.g. 'Exercise, 6:15-7:00 AM, trains STR'.
    Dimension table: describes a repeatable task, not an event."""
    __tablename__ = "quests"

    id = Column(Integer, primary_key=True, index=True)
    day_type = Column(String(10), nullable=False)   # weekday | saturday | sunday
    label = Column(String(200), nullable=False)
    time_label = Column(String(50), nullable=False)
    stat = Column(String(5), nullable=False)          # STR, INT, PER, VIT, AGI
    sort_order = Column(Integer, default=0)

    completions = relationship(
        "Completion", back_populates="quest", cascade="all, delete-orphan"
    )


class Completion(Base):
    """Fact table: one row per (quest, date) that was marked done.
    This is the actual event log the whole app is built on."""
    __tablename__ = "completions"

    id = Column(Integer, primary_key=True, index=True)
    quest_id = Column(Integer, ForeignKey("quests.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    completed = Column(Boolean, default=True)

    quest = relationship("Quest", back_populates="completions")

    __table_args__ = (UniqueConstraint("quest_id", "date", name="uq_quest_date"),)


class CoinTransaction(Base):
    __tablename__ = "coin_transactions"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    amount = Column(Integer, nullable=False)
    reason = Column(String(200), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class Shield(Base):
    """A date the user spent coins to protect their streak on."""
    __tablename__ = "shields"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, nullable=False)


class MilestoneAchieved(Base):
    __tablename__ = "milestones_achieved"

    id = Column(Integer, primary_key=True, index=True)
    milestone_key = Column(String(50), unique=True, nullable=False)
    achieved_at = Column(DateTime, server_default=func.now())


class Setting(Base):
    """Small key/value store — hunter name, etc."""
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, nullable=False)
    value = Column(String(200), nullable=False)
