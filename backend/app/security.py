"""Password hashing and signed session tokens. Standard library + PyJWT only."""
import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from sqlalchemy.orm import Session

from . import config, models

ALGORITHM = "HS256"
_PREFIX = "pbkdf2_sha256"


# ---------------------------------------------------------------------------
# Passwords: PBKDF2-HMAC-SHA256, random 16-byte salt, constant-time compare.
# (PBKDF2 ships with every Python build; scrypt/argon2 are not always available on macOS.)
# ---------------------------------------------------------------------------

def hash_password(password: str, iterations: Optional[int] = None) -> str:
    iterations = iterations or config.pbkdf2_iterations()
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return "{}${}${}${}".format(
        _PREFIX, iterations,
        base64.b64encode(salt).decode("ascii"), base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        prefix, iters, salt_b64, digest_b64 = stored.split("$")
        if prefix != _PREFIX:
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iters))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


_DUMMY_HASH: Optional[str] = None


def burn_time(password: str) -> None:
    """Spend the same time as a real check, so 'no such email' isn't faster than 'wrong password'."""
    global _DUMMY_HASH
    if _DUMMY_HASH is None:
        _DUMMY_HASH = hash_password("not-a-real-password")
    verify_password(password, _DUMMY_HASH)


# ---------------------------------------------------------------------------
# Signing secret: from JWT_SECRET, or generated once and kept in the database.
# ---------------------------------------------------------------------------

_secret_cache: Optional[str] = None


def get_jwt_secret(db: Session) -> str:
    global _secret_cache
    override = config.jwt_secret_override()
    if override:
        return override
    if _secret_cache:
        return _secret_cache
    row = db.query(models.AppSecret).filter(models.AppSecret.key == "jwt_secret").first()
    if not row:
        row = models.AppSecret(key="jwt_secret", value=secrets.token_urlsafe(64))
        db.add(row)
        try:
            db.commit()
        except Exception:  # another worker created it first
            db.rollback()
            row = db.query(models.AppSecret).filter(models.AppSecret.key == "jwt_secret").first()
    _secret_cache = row.value
    return _secret_cache


def reset_secret_cache() -> None:
    global _secret_cache
    _secret_cache = None


# ---------------------------------------------------------------------------
# Tokens. `tv` is the user's token_version: bumping it signs that user out everywhere.
# ---------------------------------------------------------------------------

def create_token(db: Session, user: "models.User") -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "tv": user.token_version,
        "iat": now,
        "exp": now + timedelta(hours=config.token_hours()),
    }
    return jwt.encode(payload, get_jwt_secret(db), algorithm=ALGORITHM)


def decode_token(db: Session, token: str) -> Optional[dict]:
    try:
        return jwt.decode(
            token, get_jwt_secret(db), algorithms=[ALGORITHM],
            options={"require": ["exp", "sub", "tv"]},
        )
    except jwt.PyJWTError:
        return None
