"""FastAPI dependencies: who is calling, what role they have, and what day it is."""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import config, models, security
from .database import get_db
from .models import utcnow

_bearer = HTTPBearer(auto_error=False)
_ACTIVE_WRITE_INTERVAL = timedelta(minutes=5)

UNAUTHORIZED = HTTPException(
    status_code=401, detail="Please sign in again.", headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> models.User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise UNAUTHORIZED
    payload = security.decode_token(db, creds.credentials)
    if not payload:
        raise UNAUTHORIZED
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise UNAUTHORIZED
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None or user.token_version != payload.get("tv"):
        raise UNAUTHORIZED
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account is disabled. Contact the admin.")
    now = utcnow()
    if user.last_active_at is None or now - user.last_active_at > _ACTIVE_WRITE_INTERVAL:
        user.last_active_at = now
        db.commit()
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    """Role check happens on the server, on every admin request. The UI hiding a button is cosmetics."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    return user


def require_onboarded(user: models.User = Depends(get_current_user)) -> models.User:
    if not user.onboarded or user.plan_start is None or user.plan_end is None:
        raise HTTPException(status_code=409, detail="Finish setting up your plan first.")
    return user


def resolve_today(today: Optional[date] = None) -> date:
    """The browser sends its own local date so server timezone never matters.

    The value is clamped to within one day of the server's UTC date (every time zone on Earth
    is within +/-1 day of UTC), so nobody can send a far-future date to farm rewards.
    """
    server = datetime.now(timezone.utc).date()
    if today is None:
        return server
    if config.trust_client_date():
        return today
    return max(server - timedelta(days=1), min(server + timedelta(days=1), today))
