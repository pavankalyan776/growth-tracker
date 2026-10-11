"""Startup work: refuse an old database layout, create tables, make sure the admin exists."""
import logging

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from . import config, crud, models, security
from .database import Base, DATABASE_URL, engine

log = logging.getLogger("growth_tracker")


def guard_legacy_schema() -> None:
    """v1/v2 stored one hunter's data with no user ids. v3 can't open that layout in place."""
    insp = inspect(engine)
    if insp.has_table("quests"):
        cols = {c["name"] for c in insp.get_columns("quests")}
        if "user_id" not in cols:
            if DATABASE_URL.startswith("sqlite"):
                fix = "Stop the server, delete backend/dev.db, and start it again."
            else:
                fix = ("Drop the old tables (quests, completions, journal, coin_transactions, shields, "
                       "purchases, milestones_achieved, settings) or point DATABASE_URL at a new empty database.")
            raise RuntimeError(
                "This database was created by Growth Tracker v1/v2 and has no user accounts. " + fix
            )


def ensure_admin(db: Session) -> None:
    email, password = config.admin_email(), config.admin_password()
    if not email or not password:
        if crud.count_active_admins(db) == 0:
            log.warning(
                "No admin account exists. Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env and restart, "
                "or run: python -m app.make_admin you@example.com"
            )
        return
    user = crud.get_user_by_email(db, email)
    if user is None:
        user = crud.create_user(db, email, "Admin", security.hash_password(password), role="admin",
                                onboarded=False)
        crud.audit(db, "admin.bootstrap", target=user, detail="Admin account created from environment")
        log.info("Admin account created for %s", email)
    elif user.role != "admin" or not user.is_active:
        user.role = "admin"
        user.is_active = True
        db.commit()
        crud.audit(db, "admin.bootstrap", target=user, detail="Existing account promoted from environment")


def init_database(session_factory) -> None:
    guard_legacy_schema()
    Base.metadata.create_all(bind=engine)
    db = session_factory()
    try:
        security.reset_secret_cache()
        security.get_jwt_secret(db)      # create the signing key now, not on the first login
        ensure_admin(db)
    finally:
        db.close()
