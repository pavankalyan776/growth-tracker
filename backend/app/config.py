"""
Settings, read lazily from environment variables so tests can change them.

JWT_SECRET is optional: if you don't set one, the app generates a strong random secret
once and stores it in the database (see security.get_jwt_secret), so it is unique per
deployment and survives restarts. Set JWT_SECRET yourself only if you run several servers
against one database.
"""
import os


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def jwt_secret_override() -> str:
    return os.getenv("JWT_SECRET", "").strip()


def token_hours() -> int:
    return max(1, _int("TOKEN_HOURS", 24 * 7))


def pbkdf2_iterations() -> int:
    # OWASP 2023 recommendation for PBKDF2-HMAC-SHA256 is 600,000.
    return max(1_000, _int("PBKDF2_ITERATIONS", 600_000))


def admin_email() -> str:
    return os.getenv("ADMIN_EMAIL", "").strip().lower()


def admin_password() -> str:
    return os.getenv("ADMIN_PASSWORD", "")


def allow_registration() -> bool:
    return _bool("ALLOW_REGISTRATION", True)


def trust_client_date() -> bool:
    """Tests only. In normal use the client's date must be within a day of the server's."""
    return _bool("TRUST_CLIENT_DATE", False)


def rate_limit_enabled() -> bool:
    return _bool("RATE_LIMIT", True)


def cache_seconds() -> int:
    """How long the Hall and the admin rollups may be reused. 0 = off."""
    return max(0, _int("CACHE_SECONDS", 20))
