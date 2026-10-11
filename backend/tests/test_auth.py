"""Accounts, sessions, rate limiting, onboarding, and data isolation between hunters."""
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app import models, security
from app.database import SessionLocal
from tests.conftest import END, PASSWORD, START, Api


def register(raw, email="a@example.com", name="Alice", password=PASSWORD, **extra):
    body = {"email": email, "password": password, "name": name}
    body.update(extra)
    return raw.post("/api/auth/register", json=body)


# ---------------------------------------------------------------------------
# Registration & login
# ---------------------------------------------------------------------------

def test_register_returns_token_and_profile(raw):
    r = register(raw, email="Alice@Example.com")
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["email"] == "alice@example.com"          # normalised to lower case
    assert body["user"]["role"] == "user" and body["user"]["onboarded"] is False
    assert "password" not in str(body).lower().replace("password_hash", "")
    me = raw.get("/api/auth/me", headers={"Authorization": "Bearer " + body["token"]})
    assert me.status_code == 200 and me.json()["name"] == "Alice"


def test_password_is_hashed_in_the_database(raw):
    register(raw)
    db = SessionLocal()
    try:
        u = db.query(models.User).filter(models.User.email == "a@example.com").one()
        assert PASSWORD not in u.password_hash
        assert u.password_hash.startswith("pbkdf2_sha256$")
    finally:
        db.close()


def test_duplicate_email_is_rejected_case_insensitively(raw):
    assert register(raw, email="dup@example.com").status_code == 201
    assert register(raw, email="DUP@example.com").status_code == 409


@pytest.mark.parametrize("password", ["short1", "allletters", "12345678", "x" * 129 + "1"])
def test_weak_passwords_rejected(raw, password):
    assert register(raw, password=password).status_code == 422


@pytest.mark.parametrize("email,name", [("not-an-email", "Alice"), ("a@example.com", "A"),
                                        ("a@example.com", "<script>x</script>")])
def test_bad_email_or_name_rejected(raw, email, name):
    assert register(raw, email=email, name=name).status_code == 422


def test_cannot_register_yourself_as_admin(raw):
    r = register(raw, email="sneaky@example.com", role="admin", is_active=True)
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "user"


def test_registration_can_be_closed(raw, monkeypatch):
    monkeypatch.setenv("ALLOW_REGISTRATION", "false")
    assert register(raw).status_code == 403


def test_login_works_and_failures_share_one_message(raw):
    register(raw)
    ok = raw.post("/api/auth/login", json={"email": "A@example.com", "password": PASSWORD})
    assert ok.status_code == 200 and ok.json()["token"]
    wrong = raw.post("/api/auth/login", json={"email": "a@example.com", "password": "Wrong1234"})
    nobody = raw.post("/api/auth/login", json={"email": "nobody@example.com", "password": "Wrong1234"})
    assert wrong.status_code == nobody.status_code == 401
    assert wrong.json()["detail"] == nobody.json()["detail"]      # no account enumeration


def test_login_is_rate_limited_per_email(raw):
    register(raw)
    for _ in range(5):
        assert raw.post("/api/auth/login", json={"email": "a@example.com", "password": "Wrong1234"}).status_code == 401
    locked = raw.post("/api/auth/login", json={"email": "a@example.com", "password": PASSWORD})
    assert locked.status_code == 429 and "Retry-After" in locked.headers
    # another account is unaffected
    register(raw, email="b@example.com", name="Bob")
    assert raw.post("/api/auth/login", json={"email": "b@example.com", "password": PASSWORD}).status_code == 200


def test_a_good_login_resets_the_failure_counter(raw):
    register(raw)
    for _ in range(4):
        raw.post("/api/auth/login", json={"email": "a@example.com", "password": "Wrong1234"})
    assert raw.post("/api/auth/login", json={"email": "a@example.com", "password": PASSWORD}).status_code == 200
    for _ in range(4):
        assert raw.post("/api/auth/login", json={"email": "a@example.com", "password": "Wrong1234"}).status_code == 401


def test_register_is_rate_limited_per_ip(raw):
    for i in range(10):
        assert register(raw, email="u{}@example.com".format(i)).status_code == 201
    assert register(raw, email="u99@example.com").status_code == 429


# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------

def test_protected_routes_need_a_valid_token(raw):
    for path in ("/api/overview", "/api/quests", "/api/auth/me", "/api/export", "/api/shop"):
        assert raw.get(path).status_code == 401
        assert raw.get(path, headers={"Authorization": "Bearer garbage"}).status_code == 401
        assert raw.get(path, headers={"Authorization": "Basic abc"}).status_code == 401


def _forge(sub, tv=0, secret=None, alg="HS256", delta=timedelta(hours=1)):
    db = SessionLocal()
    try:
        secret = secret or security.get_jwt_secret(db)
    finally:
        db.close()
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(sub), "tv": tv, "iat": now, "exp": now + delta}, secret, algorithm=alg)


def test_expired_wrong_key_and_alg_none_tokens_are_rejected(raw):
    uid = register(raw).json()["user"]["id"]
    good = _forge(uid)
    assert raw.get("/api/auth/me", headers={"Authorization": "Bearer " + good}).status_code == 200
    expired = _forge(uid, delta=timedelta(hours=-1))
    wrong_key = _forge(uid, secret="not-the-server-secret-but-long-enough-1234567890")
    unsigned = jwt.encode({"sub": str(uid), "tv": 0, "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
                          None, algorithm="none")
    for t in (expired, wrong_key, unsigned):
        assert raw.get("/api/auth/me", headers={"Authorization": "Bearer " + t}).status_code == 401


def test_token_for_deleted_or_unknown_user_is_rejected(raw):
    assert raw.get("/api/auth/me", headers={"Authorization": "Bearer " + _forge(9999)}).status_code == 401


def test_change_password_signs_out_other_sessions(raw):
    first = register(raw).json()
    h_old = {"Authorization": "Bearer " + first["token"]}
    r = raw.post("/api/auth/change-password", headers=h_old,
                 json={"current_password": PASSWORD, "new_password": "Brand9NewPass"})
    assert r.status_code == 200
    assert raw.get("/api/auth/me", headers=h_old).status_code == 401                       # old token dead
    assert raw.get("/api/auth/me", headers={"Authorization": "Bearer " + r.json()["token"]}).status_code == 200
    assert raw.post("/api/auth/login", json={"email": "a@example.com", "password": PASSWORD}).status_code == 401
    assert raw.post("/api/auth/login", json={"email": "a@example.com", "password": "Brand9NewPass"}).status_code == 200


def test_change_password_needs_the_current_one(raw):
    tok = register(raw).json()["token"]
    r = raw.post("/api/auth/change-password", headers={"Authorization": "Bearer " + tok},
                 json={"current_password": "Wrong1234", "new_password": "Brand9NewPass"})
    assert r.status_code == 400


def test_logout_everywhere_revokes_tokens(raw):
    tok = register(raw).json()["token"]
    h = {"Authorization": "Bearer " + tok}
    assert raw.post("/api/auth/logout-all", headers=h).status_code == 200
    assert raw.get("/api/auth/me", headers=h).status_code == 401


def test_profile_update_cannot_change_role(raw):
    tok = register(raw).json()["token"]
    h = {"Authorization": "Bearer " + tok}
    r = raw.patch("/api/me", headers=h, json={"name": "Alicia", "role": "admin"})
    assert r.status_code == 200 and r.json()["name"] == "Alicia" and r.json()["role"] == "user"
    assert raw.get("/api/admin/overview", headers=h).status_code == 403


def test_security_headers(raw):
    r = raw.get("/")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert raw.get("/api/overview").headers["cache-control"] == "no-store"


def test_client_date_is_clamped_to_the_server_day(signup, monkeypatch):
    api = signup()
    monkeypatch.setenv("TRUST_CLIENT_DATE", "0")
    server = datetime.now(timezone.utc).date()
    far_future = api.get("/api/overview", params={"today": "2099-01-01"}).json()
    assert far_future["today"] == (server + timedelta(days=1)).isoformat()
    far_past = api.get("/api/overview", params={"today": "2001-01-01"}).json()
    assert far_past["today"] == (server - timedelta(days=1)).isoformat()


# ---------------------------------------------------------------------------
# Onboarding
# ---------------------------------------------------------------------------

def test_tracker_routes_wait_for_onboarding(signup):
    api = signup(onboard=False)
    assert api.get("/api/overview").status_code == 409
    assert api.get("/api/quests").status_code == 409
    assert api.get("/api/auth/me").status_code == 200


def test_onboarding_validates_the_plan(signup):
    api = signup(onboard=False)
    def go(start, end, template="exam_ai"):
        return api.post("/api/onboarding", params={"today": START},
                        json={"template": template, "plan_start": start, "plan_end": end})
    assert go("2026-10-10", "2026-10-01").status_code == 400     # ends before it starts
    assert go("2026-10-01", "2026-10-03").status_code == 400     # too short
    assert go("2026-01-01", "2027-12-31").status_code == 400     # too long
    assert go(START, END, template="nope").status_code == 422
    assert go(START, END).status_code == 200
    assert go(START, END).status_code == 409                     # only once
    assert len(api.get("/api/quests").json()) == 21


def test_templates_are_listed_publicly(raw):
    keys = [t["key"] for t in raw.get("/api/templates").json()]
    assert keys == ["wellbeing", "student", "exam_ai", "focus", "blank"]


# ---------------------------------------------------------------------------
# Data isolation: one hunter can never touch another's data
# ---------------------------------------------------------------------------

def _clear_first_quest(api, d="2026-09-16"):
    day = api.get("/api/day/" + d, params={"today": d}).json()
    for t in day["tasks"]:
        api.post("/api/completions/toggle", params={"today": d},
                 json={"quest_id": t["id"], "date": d, "completed": True})


def test_hunters_cannot_see_each_others_data(signup):
    alice = signup(email="alice@example.com", name="Alice")
    bob = signup(email="bob@example.com", name="Bob")
    _clear_first_quest(alice)
    alice.put("/api/journal/2026-09-16", params={"today": "2026-09-16"},
              json={"mood": 5, "note": "ALICE-PRIVATE", "struggle": "ALICE-PAIN"})

    b = bob.get("/api/overview", params={"today": "2026-09-16"}).json()
    assert b["total_xp"] == 0 and b["hunter_name"] == "Bob"
    assert bob.get("/api/journal").json() == []
    assert bob.get("/api/journal/2026-09-16").status_code == 404
    export = bob.get("/api/export").json()
    assert export["completions"] == [] and "ALICE" not in str(export)
    alice_ids = {q["id"] for q in alice.get("/api/quests").json()}
    bob_ids = {q["id"] for q in bob.get("/api/quests").json()}
    assert alice_ids.isdisjoint(bob_ids) and len(bob_ids) == 21


def test_hunters_cannot_modify_each_others_quests(signup):
    alice = signup(email="alice@example.com", name="Alice")
    bob = signup(email="bob@example.com", name="Bob")
    a_quest = alice.get("/api/quests").json()[0]["id"]
    assert bob.put("/api/quests/{}".format(a_quest), json={"label": "pwned"}).status_code == 404
    assert bob.delete("/api/quests/{}".format(a_quest)).status_code == 404
    r = bob.post("/api/completions/toggle", params={"today": "2026-09-16"},
                 json={"quest_id": a_quest, "date": "2026-09-16", "completed": True})
    assert r.status_code == 404
    assert alice.get("/api/quests").json()[0]["label"] != "pwned"


def test_coins_shop_and_shields_are_per_user(signup):
    alice = signup(email="alice@example.com", name="Alice")
    bob = signup(email="bob@example.com", name="Bob")
    for d in ("2026-09-16", "2026-09-17", "2026-09-18"):
        _clear_first_quest(alice, d)
    assert alice.get("/api/overview", params={"today": "2026-09-18"}).json()["coins"] > 0
    assert bob.get("/api/shop").json()["coins"] == 0
    assert bob.post("/api/shop/buy", params={"today": "2026-09-18"}, json={"key": "title_riser"}).status_code == 400


# ---------------------------------------------------------------------------
# Account deletion
# ---------------------------------------------------------------------------

def test_delete_account_removes_everything(signup, raw):
    api = signup(email="gone@example.com", name="Gone")
    _clear_first_quest(api)
    assert api.post("/api/me/delete", json={"password": "Wrong1234"}).status_code == 400
    assert api.post("/api/me/delete", json={"password": PASSWORD}).status_code == 200
    assert raw.post("/api/auth/login", json={"email": "gone@example.com", "password": PASSWORD}).status_code == 401
    db = SessionLocal()
    try:
        for model in (models.Quest, models.Completion, models.Journal, models.CoinTransaction):
            assert db.query(model).filter(model.user_id == api.user["id"]).count() == 0
    finally:
        db.close()


def test_sole_admin_cannot_delete_their_own_account(admin):
    assert admin.post("/api/me/delete", json={"password": "BossPass123"}).status_code == 400


# ---------------------------------------------------------------------------
# Startup guards
# ---------------------------------------------------------------------------

def test_old_v2_database_is_refused_with_a_clear_message(monkeypatch, tmp_path):
    from sqlalchemy import create_engine, text
    from app import bootstrap

    legacy = create_engine("sqlite:///{}".format(tmp_path / "old.db"))
    with legacy.begin() as conn:
        conn.execute(text("CREATE TABLE quests (id INTEGER PRIMARY KEY, label TEXT)"))
    monkeypatch.setattr(bootstrap, "engine", legacy)
    with pytest.raises(RuntimeError, match="delete backend/dev.db"):
        bootstrap.guard_legacy_schema()


def test_password_hash_helpers():
    h = security.hash_password("Correct1Horse", iterations=1000)
    assert security.verify_password("Correct1Horse", h)
    assert not security.verify_password("correct1horse", h)
    assert not security.verify_password("x", "garbage")
    assert h != security.hash_password("Correct1Horse", iterations=1000)    # random salt
