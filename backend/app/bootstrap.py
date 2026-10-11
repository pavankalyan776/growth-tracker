"""Startup work: refuse an old database layout, create tables, make sure the admin exists."""
import logging

from sqlalchemy import inspect, text
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


# Columns added after v3 shipped. create_all() builds new TABLES but never alters existing ones,
# so a v3 database would crash on the first query. These are plain additive ALTERs, safe to repeat.
ADDED_COLUMNS = [
    ("users", "avatar", "VARCHAR(20) NOT NULL DEFAULT 'spark'"),
    ("users", "public_board", "BOOLEAN NOT NULL DEFAULT 0"),
    ("dares_done", "dare_key", "VARCHAR(30)"),
]


def ensure_columns() -> None:
    insp = inspect(engine)
    for table, column, ddl in ADDED_COLUMNS:
        if not insp.has_table(table):
            continue
        if column in {c["name"] for c in insp.get_columns(table)}:
            continue
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE {} ADD COLUMN {} {}".format(table, column, ddl)))
        log.info("Added column %s.%s", table, column)


def migrate_theme_keys(db: Session) -> None:
    """Shop colours were renamed over time. Move equipped themes and purchases to the current keys."""
    from .shop import LEGACY_KEYS
    for old, new in LEGACY_KEYS.items():
        db.query(models.User).filter(models.User.theme_key == old).update({"theme_key": new})
        for row in db.query(models.Purchase).filter(models.Purchase.item_key == old).all():
            already = db.query(models.Purchase).filter(models.Purchase.user_id == row.user_id,
                                                       models.Purchase.item_key == new).first()
            if already or new == "theme_sunset":      # Sunset is free for everyone: no purchase row needed
                db.delete(row)
            else:
                row.item_key = new
    db.commit()


def seed_templates(db: Session) -> None:
    """Keep the built-in starting timetables in step with the code, without ever overwriting an admin's edits.

    New built-ins are added; retired ones are removed; a built-in that no admin has edited is refreshed to the
    current wording and times."""
    import json
    from .seed_data import RETIRED_TEMPLATES, TEMPLATES
    rows = {t.key: t for t in db.query(models.PlanTemplate).all()}
    for key in RETIRED_TEMPLATES:
        row = rows.get(key)
        if row is not None and row.builtin:
            db.delete(row)
            rows.pop(key)
    for i, (key, t) in enumerate(TEMPLATES.items()):
        quests = [{k: q[k] for k in ("day_type", "label", "time_label", "stat")} for q in t["quests"]]
        row = rows.get(key)
        if row is None:
            db.add(models.PlanTemplate(key=key, label=t["label"], desc=t["desc"], emoji=t.get("emoji", "🌱"),
                                       builtin=True, sort_order=i, quests_json=json.dumps(quests)))
            continue
        row.sort_order = i
        edited = (db.query(models.AuditLog.id)
                  .filter(models.AuditLog.action == "content.template_edit",
                          models.AuditLog.detail.like(key + ":%")).first())
        if row.builtin and not edited:
            row.label, row.desc, row.emoji, row.quests_json = t["label"], t["desc"], t.get("emoji", "🌱"), json.dumps(quests)
    db.commit()


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
    ensure_columns()
    db = session_factory()
    try:
        security.reset_secret_cache()
        security.get_jwt_secret(db)      # create the signing key now, not on the first login
        migrate_theme_keys(db)
        seed_templates(db)
        ensure_admin(db)
    finally:
        db.close()
