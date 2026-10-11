from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint,
)

from .database import Base

# ---------------------------------------------------------------------------
# Star schema (every row below belongs to exactly one user)
#   Fact tables      : completions   (one row per quest cleared on a date, keyed by user+quest+date)
#                      dares_done    (one row per Daily Dare finished)
#   Dimension tables : users (who), quests (what), journal (how it felt); the date is implicit
#   Ledgers          : coin_transactions, purchases, shields, milestones_achieved
#   Platform tables  : audit_logs (who did what), app_secrets (server signing key)
# ---------------------------------------------------------------------------


def utcnow() -> datetime:
    """Naive UTC timestamp (works the same on SQLite and MySQL, and avoids deprecated utcnow())."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(254), unique=True, nullable=False, index=True)   # stored lower-case
    name = Column(String(40), nullable=False)                               # the hunter name
    password_hash = Column(String(255), nullable=False)
    role = Column(String(10), nullable=False, default="user")               # user | admin
    is_active = Column(Boolean, nullable=False, default=True)
    token_version = Column(Integer, nullable=False, default=0)              # bump = sign out everywhere
    onboarded = Column(Boolean, nullable=False, default=False)
    plan_start = Column(Date, nullable=True)
    plan_end = Column(Date, nullable=True)
    title_key = Column(String(50), nullable=False, default="title_rookie")
    theme_key = Column(String(50), nullable=False, default="theme_sunset")
    avatar = Column(String(20), nullable=False, default="spark")            # one of avatars.AVATARS
    public_board = Column(Boolean, nullable=False, default=False)           # opt in to the Hall leaderboard
    created_at = Column(DateTime, nullable=False, default=utcnow)
    last_login_at = Column(DateTime, nullable=True)
    last_active_at = Column(DateTime, nullable=True)


class Quest(Base):
    """Dimension: a repeatable task template, e.g. 'Exercise, 6:15-7:00 AM, trains STR'."""
    __tablename__ = "quests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    day_type = Column(String(10), nullable=False)   # weekday | saturday | sunday
    label = Column(String(200), nullable=False)
    time_label = Column(String(50), nullable=False)
    stat = Column(String(5), nullable=False)          # STR, INT, PER, VIT, AGI
    sort_order = Column(Integer, default=0)


class Completion(Base):
    """Fact: this user cleared this quest on this date."""
    __tablename__ = "completions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quest_id = Column(Integer, ForeignKey("quests.id"), nullable=False)
    date = Column(Date, nullable=False)
    completed = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("quest_id", "date", name="uq_quest_date"),
        Index("ix_completions_user_date", "user_id", "date"),
    )


class DareDone(Base):
    """Fact: this user finished the Daily Dare of this date. (Which dare it was is derived, see dares.py.)"""
    __tablename__ = "dares_done"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    dare_key = Column(String(30), nullable=True)     # which dare it was, so history survives pool edits

    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_dare_user_date"),)


class Journal(Base):
    """One reflection per day: mood, what happened, and what hurt / what you struggled with."""
    __tablename__ = "journal"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    mood = Column(Integer, nullable=True)            # 1..5
    note = Column(Text, nullable=False, default="")
    struggle = Column(Text, nullable=False, default="")

    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_journal_user_date"),)


class CoinTransaction(Base):
    __tablename__ = "coin_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    amount = Column(Integer, nullable=False)
    reason = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=utcnow)


class Shield(Base):
    """A past date the user spent coins on to protect their streak."""
    __tablename__ = "shields"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_shield_user_date"),)


class Purchase(Base):
    """A cosmetic shop item the user owns (virtual only)."""
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_key = Column(String(50), nullable=False)
    cost = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    __table_args__ = (UniqueConstraint("user_id", "item_key", name="uq_purchase_user_item"),)


class MilestoneAchieved(Base):
    __tablename__ = "milestones_achieved"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    milestone_key = Column(String(50), nullable=False)
    achieved_at = Column(DateTime, default=utcnow)

    __table_args__ = (UniqueConstraint("user_id", "milestone_key", name="uq_milestone_user_key"),)


class Challenge(Base):
    """A challenge the member builds themselves: 'Meditate, 10 check-ins in the next 14 days'."""
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(60), nullable=False)
    emoji = Column(String(8), nullable=False, default="🎯")
    target = Column(Integer, nullable=False)          # check-ins needed
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)           # inclusive
    archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)


class ChallengeCheckin(Base):
    __tablename__ = "challenge_checkins"

    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False)

    __table_args__ = (UniqueConstraint("challenge_id", "date", name="uq_checkin_challenge_date"),)


class CustomDare(Base):
    """Content the admin adds from the Content studio. Joins the built-in dares in dares.py."""
    __tablename__ = "custom_dares"

    id = Column(Integer, primary_key=True, index=True)
    label = Column(String(120), nullable=False)
    hint = Column(String(160), nullable=False, default="")
    category = Column(String(10), nullable=False, default="mind")     # body | mind | kind | home
    emoji = Column(String(8), nullable=False, default="✨")
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)


class Announcement(Base):
    """A message from the admin that appears on every member's Today screen until it expires."""
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(80), nullable=False)
    body = Column(String(300), nullable=False, default="")
    emoji = Column(String(8), nullable=False, default="📣")
    tone = Column(String(10), nullable=False, default="info")        # info | tip | party
    active = Column(Boolean, nullable=False, default=True)
    expires_on = Column(Date, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)


class PlanTemplate(Base):
    """Starting plans offered during onboarding. Seeded from seed_data.py, then editable by the admin."""
    __tablename__ = "plan_templates"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(30), unique=True, nullable=False)
    label = Column(String(60), nullable=False)
    desc = Column(String(200), nullable=False, default="")
    emoji = Column(String(8), nullable=False, default="🌱")
    active = Column(Boolean, nullable=False, default=True)
    builtin = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)
    quests_json = Column(Text, nullable=False, default="[]")          # [{day_type,label,time_label,stat}]


class AuditLog(Base):
    """Who did what. Written for sign-ups, logins and every admin action."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, nullable=False, default=utcnow, index=True)
    actor_id = Column(Integer, nullable=True, index=True)          # no FK: logs outlive deleted users
    actor_email = Column(String(254), nullable=True)
    action = Column(String(50), nullable=False, index=True)
    target_id = Column(Integer, nullable=True)
    target_email = Column(String(254), nullable=True)
    detail = Column(String(300), nullable=False, default="")


class AppSecret(Base):
    """Server-side secrets (the token signing key). Never returned by any endpoint."""
    __tablename__ = "app_secrets"

    id = Column(Integer, primary_key=True)
    key = Column(String(50), unique=True, nullable=False)
    value = Column(String(255), nullable=False)
