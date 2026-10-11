"""Accounts: register, sign in, profile, password, plan window, delete account."""
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import config, crud, models, schemas, security
from ..database import get_db
from ..deps import get_current_user, resolve_today
from ..models import utcnow
from ..ratelimit import limiter

router = APIRouter(prefix="/api", tags=["auth"])

LOGIN_WINDOW = 15 * 60
LOGIN_MAX_FAILS_PER_EMAIL = 5
LOGIN_MAX_FAILS_PER_IP = 30
REGISTER_WINDOW = 60 * 60
REGISTER_MAX_PER_IP = 10

MIN_PLAN_DAYS = 7
MAX_PLAN_DAYS = 366


def client_ip(request: Request) -> str:
    """Behind Railway's proxy the real client is the LAST address in X-Forwarded-For."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[-1].strip() or "unknown"
    return request.client.host if request.client else "unknown"


def _auth_response(db: Session, user: models.User) -> dict:
    return {"token": security.create_token(db, user), "user": schemas.UserOut.model_validate(user)}


def _validate_plan(start: date, end: date, today: date) -> None:
    if end < start:
        raise HTTPException(status_code=400, detail="The plan can't end before it starts.")
    length = (end - start).days + 1
    if length < MIN_PLAN_DAYS:
        raise HTTPException(status_code=400, detail="A plan needs at least {} days.".format(MIN_PLAN_DAYS))
    if length > MAX_PLAN_DAYS:
        raise HTTPException(status_code=400, detail="A plan can be at most {} days.".format(MAX_PLAN_DAYS))
    if start < today - timedelta(days=366):
        raise HTTPException(status_code=400, detail="The start date is too far in the past.")
    if end < today - timedelta(days=1):
        raise HTTPException(status_code=400, detail="The plan has to run into the future.")


# ---------------------------------------------------------------------------

@router.post("/auth/register", response_model=schemas.AuthOut, status_code=201)
def register(payload: schemas.RegisterIn, request: Request, db: Session = Depends(get_db)):
    if not config.allow_registration():
        raise HTTPException(status_code=403, detail="Sign-ups are closed on this server.")
    ip_key = "register:" + client_ip(request)
    limiter.check(ip_key, REGISTER_MAX_PER_IP, REGISTER_WINDOW)
    limiter.hit(ip_key, REGISTER_WINDOW)

    email = payload.email.lower()
    if crud.get_user_by_email(db, email):
        raise HTTPException(status_code=409, detail="An account with that email already exists. Sign in instead.")
    try:
        user = crud.create_user(db, email, payload.name, security.hash_password(payload.password))
    except IntegrityError:   # two sign-ups with the same email at the same instant
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with that email already exists. Sign in instead.")
    user.last_login_at = user.last_active_at = utcnow()
    db.commit()
    crud.audit(db, "auth.register", actor=user, target=user)
    return _auth_response(db, user)


@router.post("/auth/login", response_model=schemas.AuthOut)
def login(payload: schemas.LoginIn, request: Request, db: Session = Depends(get_db)):
    email = payload.email.lower()
    email_key = "login-email:" + email
    ip_key = "login-ip:" + client_ip(request)
    limiter.check(email_key, LOGIN_MAX_FAILS_PER_EMAIL, LOGIN_WINDOW)
    limiter.check(ip_key, LOGIN_MAX_FAILS_PER_IP, LOGIN_WINDOW)

    user = crud.get_user_by_email(db, email)
    ok = False
    if user is None:
        security.burn_time(payload.password)
    else:
        ok = security.verify_password(payload.password, user.password_hash)
    if not ok:
        limiter.hit(email_key, LOGIN_WINDOW)
        limiter.hit(ip_key, LOGIN_WINDOW)
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account is disabled. Contact the admin.")

    limiter.reset(email_key)
    user.last_login_at = user.last_active_at = utcnow()
    db.commit()
    crud.audit(db, "auth.login", actor=user, target=user)
    return _auth_response(db, user)


@router.get("/auth/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user


@router.post("/auth/logout-all")
def logout_everywhere(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.token_version += 1
    db.commit()
    crud.audit(db, "auth.logout_all", actor=user, target=user)
    return {"ok": True}


@router.post("/auth/change-password", response_model=schemas.AuthOut)
def change_password(payload: schemas.ChangePasswordIn, user: models.User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    key = "pw-change:{}".format(user.id)
    limiter.check(key, 5, LOGIN_WINDOW)
    if not security.verify_password(payload.current_password, user.password_hash):
        limiter.hit(key, LOGIN_WINDOW)
        raise HTTPException(status_code=400, detail="Your current password is incorrect.")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="Choose a password you haven't used just now.")
    user.password_hash = security.hash_password(payload.new_password)
    user.token_version += 1          # every other device is signed out
    db.commit()
    crud.audit(db, "auth.password_change", actor=user, target=user)
    return _auth_response(db, user)


@router.patch("/me", response_model=schemas.UserOut)
def update_profile(payload: schemas.ProfileUpdate, user: models.User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    user.name = payload.name
    db.commit()
    return user


@router.post("/me/delete")
def delete_account(payload: schemas.DeleteAccountIn, user: models.User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    key = "pw-delete:{}".format(user.id)
    limiter.check(key, 5, LOGIN_WINDOW)
    if not security.verify_password(payload.password, user.password_hash):
        limiter.hit(key, LOGIN_WINDOW)
        raise HTTPException(status_code=400, detail="Password is incorrect.")
    if user.role == "admin" and crud.count_active_admins(db) <= 1:
        raise HTTPException(status_code=400, detail="You're the only admin. Promote someone else first.")
    crud.audit(db, "user.delete_self", actor=user, target=user)
    crud.delete_user_and_data(db, user.id)
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Onboarding & plan window
# ---------------------------------------------------------------------------

@router.post("/onboarding", response_model=schemas.UserOut)
def complete_onboarding(payload: schemas.OnboardingIn, today: Optional[date] = None,
                        user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.onboarded:
        raise HTTPException(status_code=409, detail="You've already set up your plan.")
    _validate_plan(payload.plan_start, payload.plan_end, resolve_today(today))
    crud.seed_quests(db, user.id, payload.template)
    user.plan_start, user.plan_end, user.onboarded = payload.plan_start, payload.plan_end, True
    db.commit()
    crud.audit(db, "user.onboarded", actor=user, target=user, detail="template=" + payload.template)
    return user


@router.put("/plan", response_model=schemas.UserOut)
def update_plan(payload: schemas.OnboardingPlanIn, today: Optional[date] = None,
                user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.onboarded:
        raise HTTPException(status_code=409, detail="Finish setting up your plan first.")
    _validate_plan(payload.plan_start, payload.plan_end, resolve_today(today))
    user.plan_start, user.plan_end = payload.plan_start, payload.plan_end
    db.commit()
    return user


@router.get("/templates")
def list_templates():
    from ..seed_data import TEMPLATES
    return [{"key": k, "label": v["label"], "desc": v["desc"], "quests": len(v["quests"])}
            for k, v in TEMPLATES.items()]
