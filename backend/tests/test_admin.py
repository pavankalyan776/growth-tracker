"""RBAC: what an admin can do, what a normal user can't, and what nobody can read."""
import json

import pytest

from app import models
from app.database import SessionLocal
from tests.conftest import PASSWORD

ADMIN_GETS = ["/api/admin/overview", "/api/admin/users", "/api/admin/users/1", "/api/admin/audit"]


def _clear_day(api, d):
    day = api.get("/api/day/" + d, params={"today": d}).json()
    for t in day["tasks"]:
        api.post("/api/completions/toggle", params={"today": d},
                 json={"quest_id": t["id"], "date": d, "completed": True})


def test_anonymous_and_normal_users_are_locked_out(raw, client):
    for path in ADMIN_GETS:
        assert raw.get(path).status_code == 401
        assert client.get(path).status_code == 403
    assert client.patch("/api/admin/users/1", json={"role": "admin"}).status_code == 403
    assert client.post("/api/admin/users/1/force-logout").status_code == 403
    assert client.delete("/api/admin/users/1").status_code == 403


def test_admin_account_is_created_from_the_environment(admin):
    assert admin.user["role"] == "admin" and admin.user["email"] == "boss@example.com"
    assert admin.get("/api/admin/overview").status_code == 200


def test_overview_numbers(signup, admin):
    alice = signup(email="alice@example.com", name="Alice")
    signup(email="bob@example.com", name="Bob", onboard=False)
    for d in ("2026-09-16", "2026-09-17", "2026-09-18"):
        _clear_day(alice, d)
    o = admin.get("/api/admin/overview", params={"today": "2026-09-18"}).json()
    t = o["totals"]
    assert t["users"] == 2 and t["admins"] == 1 and t["onboarded"] == 1       # admins are not counted as members
    assert t["tasks_done"] == 21
    steps = {f["step"]: f["count"] for f in o["funnel"]}
    assert steps["Registered"] == 2 and steps["Finished a task"] == 1 and steps["3-day streak"] == 1
    assert steps["7-day streak"] == 0
    assert len(o["series"]) == 30
    last = [s for s in o["series"] if s["date"] == "2026-09-18"][0]
    assert last["active_members"] == 1 and last["tasks_done"] == 7
    assert {r["rank"] for r in o["rank_distribution"]} == {"E", "D", "C", "B", "A", "S"}
    assert any(a["action"] == "auth.register" for a in o["recent_audit"])


def test_user_list_search_filter_sort_and_pages(signup, admin):
    alice = signup(email="alice@example.com", name="Alice")
    signup(email="bob@example.com", name="Bobby")
    signup(email="carol@example.com", name="Carol")
    for d in ("2026-09-16", "2026-09-17"):
        _clear_day(alice, d)
    p = {"today": "2026-09-18"}
    assert admin.get("/api/admin/users", params=dict(p, q="bob")).json()["total"] == 1
    assert admin.get("/api/admin/users", params=dict(p, role="admin")).json()["total"] == 1
    assert admin.get("/api/admin/users", params=dict(p, role="all")).json()["total"] == 4
    page = admin.get("/api/admin/users", params=dict(p, page_size=2)).json()
    assert page["total"] == 3 and len(page["items"]) == 2          # members only by default
    by_level = admin.get("/api/admin/users", params=dict(p, sort="level", order="desc")).json()["items"]
    assert by_level[0]["email"] == "alice@example.com"
    assert by_level[0]["stats"]["current_streak"] == 2
    assert admin.get("/api/admin/users", params=dict(p, sort="password_hash")).status_code == 400


def test_user_detail_has_progress_but_never_private_writing(signup, admin):
    alice = signup(email="alice@example.com", name="Alice")
    _clear_day(alice, "2026-09-16")
    alice.put("/api/journal/2026-09-16", params={"today": "2026-09-16"},
              json={"mood": 1, "note": "SECRET-NOTE-XYZ", "struggle": "SECRET-STRUGGLE-XYZ"})
    p = {"today": "2026-09-17"}
    detail = admin.get("/api/admin/users/{}".format(alice.user["id"]), params=p).json()
    assert detail["stats"]["level"] == 1 and detail["stats"]["perfect_days"] == 1
    assert detail["stats"]["journal_entries"] == 1               # a count, not the text
    assert detail["recent_days"][0] == {"date": "2026-09-16", "pct": 100}

    everything = ""
    for path in ADMIN_GETS[:2] + ["/api/admin/users/{}".format(alice.user["id"]), "/api/admin/audit"]:
        everything += admin.get(path, params=p).text
    for forbidden in ("SECRET-NOTE-XYZ", "SECRET-STRUGGLE-XYZ", "password_hash", "pbkdf2", "Govt Exam", "jwt_secret"):
        assert forbidden not in everything
    # and there is simply no admin route that returns a journal
    assert admin.get("/api/admin/users/{}/journal".format(alice.user["id"])).status_code in (404, 405)
    assert admin.get("/api/journal").status_code == 409          # the admin's own tracker is separate and empty


def test_unknown_user_is_404(admin):
    assert admin.get("/api/admin/users/9999").status_code == 404
    assert admin.patch("/api/admin/users/9999", json={"is_active": False}).status_code == 404


def test_disable_blocks_login_and_kicks_out_live_sessions(signup, admin, raw):
    alice = signup(email="alice@example.com", name="Alice")
    assert alice.get("/api/overview").status_code == 200
    r = admin.patch("/api/admin/users/{}".format(alice.user["id"]), json={"is_active": False})
    assert r.status_code == 200 and r.json()["is_active"] is False
    assert alice.get("/api/overview").status_code == 401         # existing token is dead at once
    login = raw.post("/api/auth/login", json={"email": "alice@example.com", "password": PASSWORD})
    assert login.status_code == 403 and "disabled" in login.json()["detail"]
    admin.patch("/api/admin/users/{}".format(alice.user["id"]), json={"is_active": True})
    assert raw.post("/api/auth/login", json={"email": "alice@example.com", "password": PASSWORD}).status_code == 200


def test_promote_and_demote(signup, admin):
    alice = signup(email="alice@example.com", name="Alice")
    assert alice.get("/api/admin/overview").status_code == 403
    admin.patch("/api/admin/users/{}".format(alice.user["id"]), json={"role": "admin"})
    assert alice.get("/api/admin/overview").status_code == 200   # role is read from the DB each request
    admin.patch("/api/admin/users/{}".format(alice.user["id"]), json={"role": "user"})
    assert alice.get("/api/admin/overview").status_code == 403


def test_admin_cannot_lock_themselves_out(admin):
    me = admin.user["id"]
    assert admin.patch("/api/admin/users/{}".format(me), json={"role": "user"}).status_code == 400
    assert admin.patch("/api/admin/users/{}".format(me), json={"is_active": False}).status_code == 400
    assert admin.delete("/api/admin/users/{}".format(me)).status_code == 400
    assert admin.patch("/api/admin/users/{}".format(me), json={}).status_code == 400


def test_bad_role_value_is_rejected(signup, admin):
    alice = signup(email="alice@example.com", name="Alice")
    assert admin.patch("/api/admin/users/{}".format(alice.user["id"]), json={"role": "superuser"}).status_code == 422


def test_force_logout(signup, admin):
    alice = signup(email="alice@example.com", name="Alice")
    assert admin.post("/api/admin/users/{}/force-logout".format(alice.user["id"])).status_code == 200
    assert alice.get("/api/overview").status_code == 401


def test_delete_user_wipes_their_data(signup, admin):
    alice = signup(email="alice@example.com", name="Alice")
    _clear_day(alice, "2026-09-16")
    uid = alice.user["id"]
    assert admin.delete("/api/admin/users/{}".format(uid)).status_code == 200
    db = SessionLocal()
    try:
        assert db.query(models.User).filter(models.User.id == uid).count() == 0
        for model in (models.Quest, models.Completion, models.CoinTransaction):
            assert db.query(model).filter(model.user_id == uid).count() == 0
    finally:
        db.close()


def test_cannot_delete_another_admin_without_demoting(signup, admin):
    alice = signup(email="alice@example.com", name="Alice")
    admin.patch("/api/admin/users/{}".format(alice.user["id"]), json={"role": "admin"})
    assert admin.delete("/api/admin/users/{}".format(alice.user["id"])).status_code == 400


def test_every_admin_action_is_audited(signup, admin):
    alice = signup(email="alice@example.com", name="Alice")
    uid = alice.user["id"]
    admin.get("/api/admin/users/{}".format(uid))
    admin.get("/api/admin/users/{}".format(uid))                 # de-duplicated within 10 minutes
    admin.patch("/api/admin/users/{}".format(uid), json={"role": "admin"})
    admin.patch("/api/admin/users/{}".format(uid), json={"is_active": False})
    admin.post("/api/admin/users/{}/force-logout".format(uid))
    items = admin.get("/api/admin/audit", params={"page_size": 50}).json()["items"]
    actions = [i["action"] for i in items]
    assert actions.count("admin.view_user") == 1
    for needed in ("auth.register", "admin.role_change", "admin.disable", "admin.force_logout", "auth.login"):
        assert needed in actions
    change = [i for i in items if i["action"] == "admin.role_change"][0]
    assert change["actor_email"] == "boss@example.com" and change["target_email"] == "alice@example.com"
    assert change["detail"] == "user -> admin"
    only = admin.get("/api/admin/audit", params={"action": "admin."}).json()
    assert all(i["action"].startswith("admin.") for i in only["items"])
