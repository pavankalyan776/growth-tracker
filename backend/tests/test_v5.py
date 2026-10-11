"""v5: member-built challenges, the admin Content studio (dares, announcements, starting plans),
one-call writes, caching, and the theme migration."""
import json
from datetime import date, timedelta

import pytest

from app import cache, config

T = "2026-09-16"


def day(c, d, today=None):
    return c.get("/api/day/{}".format(d), params={"today": today or d}).json()


def overview(c, today=T):
    return c.get("/api/overview", params={"today": today}).json()


def new_challenge(c, today=T, **kw):
    body = {"title": "Read every night", "emoji": "📖", "target": 3, "days": 5}
    body.update(kw)
    return c.post("/api/challenges", params={"today": today}, json=body)


def checkin(c, cid, d, done=True, today=None):
    return c.post("/api/challenges/{}/checkin".format(cid), params={"today": today or d},
                  json={"date": d, "done": done})


def d(n):
    return (date(2026, 9, 16) + timedelta(days=n)).isoformat()


# ------------------------- member-built challenges ---------------------------

def test_create_validates_everything(client):
    assert new_challenge(client).status_code == 201
    assert new_challenge(client, target=6, days=5).status_code == 400                  # more check-ins than days
    assert new_challenge(client, target=2).status_code == 422                          # too few check-ins
    assert new_challenge(client, title="x").status_code == 422
    assert new_challenge(client, title="<b>hi</b>").status_code == 422
    assert new_challenge(client, emoji="abc").status_code == 422
    assert new_challenge(client, start_date="2026-09-10").status_code == 400            # no back-dating
    assert new_challenge(client, start_date="2026-12-30", days=5).status_code == 400    # runs past the plan
    assert new_challenge(client, start_date="2026-12-31", days=3).status_code == 400    # starts at the plan's last day


def test_at_most_five_live_challenges(client):
    for i in range(5):
        assert new_challenge(client, title="Habit number {}".format(i)).status_code == 201
    r = new_challenge(client, title="One too many")
    assert r.status_code == 400 and "live challenges" in r.json()["detail"]


def test_checkin_progress_completion_and_rewards(client):
    cid = new_challenge(client).json()["challenge"]["id"]
    before = overview(client, d(0))
    for i in range(2):
        r = checkin(client, cid, d(i)).json()
        assert r["challenge"]["done"] == i + 1 and r["challenge"]["status"] == "active"
        assert r["xp_delta"] == 0
    r = checkin(client, cid, d(2)).json()
    assert r["challenge"]["status"] == "done" and r["challenge"]["rewarded"] is True
    assert r["xp_delta"] == 30
    assert [e["kind"] for e in r["events"] if e["kind"] == "challenge"] == ["challenge"]
    after = r["overview"]
    assert after["total_xp"] == before["total_xp"] + 30
    # +15 challenge coins, +30 "Challenge Maker" milestone, +5 daily login on each of the two later days
    assert after["coins"] == before["coins"] + 15 + 30 + 5 + 5
    assert after["challenges_done"] == 1
    # undoing and redoing never pays twice
    checkin(client, cid, d(2), False, today=d(2))
    again = checkin(client, cid, d(2), True, today=d(2)).json()
    assert again["overview"]["coins"] == after["coins"] and again["overview"]["total_xp"] == after["total_xp"]


def test_checkin_rules(client):
    cid = new_challenge(client, days=5).json()["challenge"]["id"]
    assert checkin(client, cid, "2026-09-25", today=T).status_code == 400              # outside the window
    assert checkin(client, cid, d(3), today=T).status_code == 400                      # future day
    assert checkin(client, 9999, T).status_code == 404
    for i in range(3):
        assert checkin(client, cid, d(i)).status_code == 200
    r = checkin(client, cid, d(3))                                                    # already finished
    assert r.status_code == 400 and "finished" in r.json()["detail"]


def test_weekly_cap_limits_rewards_but_not_progress(client):
    """Three challenges finished in the same week: only the first two pay XP and coins."""
    ids = [new_challenge(client, title="Challenge {}".format(i)).json()["challenge"]["id"] for i in range(3)]
    for i in range(3):
        for cid in ids:
            checkin(client, cid, d(i))
    o = overview(client, d(2))
    assert o["challenges_done"] == 3
    states = {c["id"]: c for c in o["challenges"]}
    assert sum(1 for c in states.values() if c["rewarded"]) == 2
    assert o["total_xp"] == 60 + 0     # no quests were cleared; only the two rewarded challenges count
    txs = client.get("/api/export").json()["coin_transactions"]
    assert len([t for t in txs if t["reason"].startswith("Challenge done")]) == 2


def test_missed_and_upcoming_statuses(client):
    a = new_challenge(client, days=3, target=3).json()["challenge"]
    up = new_challenge(client, title="Starts later", start_date=d(2), days=5).json()["challenge"]
    assert up["status"] == "upcoming"
    later = overview(client, d(6))
    st = {c["id"]: c for c in client.get("/api/challenges", params={"today": d(6)}).json()["items"]}
    assert st[a["id"]]["status"] == "missed" and st[up["id"]]["status"] == "active"
    assert later is not None


def test_archive_and_delete_rules(client):
    cid = new_challenge(client).json()["challenge"]["id"]
    for i in range(3):
        checkin(client, cid, d(i))
    assert client.delete("/api/challenges/{}".format(cid), params={"today": d(2)}).status_code == 400   # finished: keep points
    r = client.patch("/api/challenges/{}".format(cid), params={"today": d(2)}, json={"archived": True}).json()
    assert r["challenge"]["status"] == "archived"
    assert overview(client, d(2))["total_xp"] == 30                                      # XP stays after archiving
    other = new_challenge(client, title="Never finished").json()["challenge"]["id"]
    assert client.delete("/api/challenges/{}".format(other)).status_code == 200
    assert client.delete("/api/challenges/{}".format(other)).status_code == 404
    assert client.patch("/api/challenges/{}".format(cid), json={}).status_code == 400


def test_challenges_are_private_to_their_owner(signup):
    a, b = signup("a@example.com", "Alpha"), signup("b@example.com", "Bravo")
    cid = new_challenge(a).json()["challenge"]["id"]
    assert checkin(b, cid, T).status_code == 404
    assert b.delete("/api/challenges/{}".format(cid)).status_code == 404
    assert b.patch("/api/challenges/{}".format(cid), json={"archived": True}).status_code == 404
    assert b.get("/api/challenges", params={"today": T}).json()["items"] == []


def test_maker_milestones_exist(client):
    ids = {m["id"]: m for m in client.get("/api/milestones").json()}
    assert ids["maker"]["emoji"] and ids["maker_5"]["reward"] == 100 and len(ids) == 22


def test_admin_sees_challenge_counts_never_titles(signup, admin):
    a = signup("a@example.com", "Alpha")
    cid = new_challenge(a, title="Secret plan").json()["challenge"]["id"]
    for i in range(3):
        checkin(a, cid, d(i))
    users = admin.get("/api/admin/users", params={"today": d(2)}).json()
    blob = json.dumps(users) + json.dumps(admin.get("/api/admin/overview", params={"today": d(2)}).json())
    assert "Secret plan" not in blob
    alpha = [u for u in users["items"] if u["email"] == "a@example.com"][0]
    assert alpha["stats"]["challenges_done"] == 1
    assert admin.get("/api/admin/overview", params={"today": d(2)}).json()["totals"]["challenges_built"] == 1


def test_export_and_account_deletion_cover_challenges(signup, raw):
    a = signup("a@example.com", "Alpha")
    cid = new_challenge(a).json()["challenge"]["id"]
    checkin(a, cid, T)
    exp = a.get("/api/export").json()
    assert exp["challenges"][0]["title"] == "Read every night" and exp["challenges"][0]["checkins"] == [T]
    assert a.post("/api/me/delete", json={"password": "Sup3rSecret"}).status_code == 200
    from app import models
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        assert db.query(models.Challenge).count() == 0 and db.query(models.ChallengeCheckin).count() == 0
    finally:
        db.close()


# ------------------------------ one-call writes ------------------------------

def test_toggle_returns_the_fresh_overview_and_day(client):
    t = day(client, T)["tasks"][0]
    r = client.post("/api/completions/toggle", params={"today": T},
                    json={"quest_id": t["id"], "date": T, "completed": True}).json()
    assert r["overview"] == {**overview(client), "events": []} or r["overview"]["total_xp"] == overview(client)["total_xp"]
    assert r["overview"]["total_xp"] == 10 and r["overview"]["today_score"]["count"] == 1
    assert r["day"]["tasks"][0]["completed"] is True and r["day"]["score"]["count"] == 1
    rd = client.post("/api/dares/toggle", params={"today": T}, json={"date": T, "completed": True}).json()
    assert rd["day"]["dare"]["done"] is True and rd["overview"]["dares_done"] == 1


def test_journal_text_is_not_loaded_into_overview_but_still_served(client):
    client.put("/api/journal/{}".format(T), params={"today": T}, json={"mood": 3, "note": "n", "struggle": "hard bit"})
    assert day(client, T)["journal"]["struggle"] == "hard bit"
    assert "hard bit" not in json.dumps(overview(client))
    missed = client.get("/api/analytics", params={"today": "2026-09-18"}).json()["missed"]
    assert any(m["struggle"] == "hard bit" for m in missed)


# ------------------------- admin content: dares ------------------------------

def test_non_admins_cannot_touch_content(client):
    for method, url, body in [("get", "/api/admin/content/dares", None),
                              ("post", "/api/admin/content/dares", {"label": "Sing a song loudly"}),
                              ("get", "/api/admin/content/announcements", None),
                              ("post", "/api/admin/content/templates", {"key": "mine", "label": "Mine"})]:
        r = getattr(client, method)(url, **({"json": body} if body else {}))
        assert r.status_code == 403, url


def test_admin_adds_edits_hides_and_deletes_dares(admin):
    r = admin.post("/api/admin/content/dares", json={"label": "Sing in the shower", "category": "mind", "emoji": "🎤"})
    assert r.status_code == 201
    dare = r.json()
    assert dare["key"] == "c{}".format(dare["id"]) and dare["active"]
    lst = admin.get("/api/admin/content/dares").json()
    assert len(lst["builtin"]) == 36 and lst["custom"][0]["label"] == "Sing in the shower"
    assert admin.patch("/api/admin/content/dares/{}".format(dare["id"]), json={"hint": "Loudly."}).json()["hint"] == "Loudly."
    assert admin.patch("/api/admin/content/dares/{}".format(dare["id"]), json={"active": False}).json()["active"] is False
    assert admin.patch("/api/admin/content/dares/{}".format(dare["id"]), json={}).status_code == 400
    assert admin.delete("/api/admin/content/dares/{}".format(dare["id"])).json() == {"deleted": True}
    assert admin.delete("/api/admin/content/dares/{}".format(dare["id"])).status_code == 404
    actions = [a["action"] for a in admin.get("/api/admin/audit").json()["items"]]
    assert {"content.dare_add", "content.dare_edit", "content.dare_delete"} <= set(actions)


def test_dare_input_is_validated(admin):
    assert admin.post("/api/admin/content/dares", json={"label": "no"}).status_code == 422
    assert admin.post("/api/admin/content/dares", json={"label": "<script>alert(1)</script>"}).status_code == 422
    assert admin.post("/api/admin/content/dares", json={"label": "Fine label", "emoji": "ab"}).status_code == 422
    assert admin.post("/api/admin/content/dares", json={"label": "Fine label", "category": "zzz"}).status_code == 422


def test_custom_dares_join_the_pool_but_never_rewrite_history(signup, admin, raw):
    from app import models
    from app.database import SessionLocal
    a = signup("a@example.com", "Alpha")
    first = day(a, T)["dare"]
    assert a.post("/api/dares/toggle", params={"today": T}, json={"date": T, "completed": True}).status_code == 200
    # an admin adds dares, backdated so they count as existing for every past day
    ids = []
    for i in range(5):
        ids.append(admin.post("/api/admin/content/dares", json={"label": "Custom dare number {}".format(i)}).json()["id"])
    db = SessionLocal()
    try:
        for row in db.query(models.CustomDare).all():
            row.created_at = row.created_at - timedelta(days=400)
        db.commit()
    finally:
        db.close()
    # the finished day still shows what was actually done
    assert day(a, T)["dare"]["key"] == first["key"] and day(a, T)["dare"]["done"] is True
    # and custom dares do show up across the following weeks
    seen = {day(a, d(i))["dare"]["key"] for i in range(1, 60)}
    assert any(k.startswith("c") for k in seen)
    # a custom dare someone finished can be hidden but not deleted
    custom_day = next(d(i) for i in range(1, 60) if day(a, d(i))["dare"]["key"].startswith("c"))
    key = day(a, custom_day)["dare"]["key"]
    assert a.post("/api/dares/toggle", params={"today": custom_day}, json={"date": custom_day, "completed": True}).status_code == 200
    assert admin.delete("/api/admin/content/dares/{}".format(key[1:])).status_code == 409
    admin.patch("/api/admin/content/dares/{}".format(key[1:]), json={"active": False})
    assert day(a, custom_day)["dare"]["key"] == key          # history intact even though it is now hidden


def test_a_new_dare_does_not_change_todays_dare(signup, admin):
    a = signup("a@example.com", "Alpha")
    before = [day(a, d(i))["dare"]["key"] for i in range(0, 20)]
    admin.post("/api/admin/content/dares", json={"label": "Brand new dare today"})
    after = [day(a, d(i))["dare"]["key"] for i in range(0, 20)]
    created = date.today()
    # the dare joins the pool for days AFTER it is created; every test day here is earlier than "now"
    assert before == after
    assert created is not None


# ----------------------------- announcements --------------------------------

def test_announcements_reach_members_until_they_expire(signup, admin):
    a = signup("a@example.com", "Alpha")
    r = admin.post("/api/admin/content/announcements",
                   json={"title": "Weekend challenge", "body": "Try a new dare!", "emoji": "🎉", "tone": "party",
                         "expires_on": "2026-09-20"})
    assert r.status_code == 201
    ann = overview(a, T)["announcements"]
    assert ann[0]["title"] == "Weekend challenge" and ann[0]["emoji"] == "🎉"
    assert overview(a, "2026-09-20")["announcements"]            # still on its last day
    assert overview(a, "2026-09-21")["announcements"] == []      # expired
    admin.patch("/api/admin/content/announcements/{}".format(r.json()["id"]), json={"clear_expiry": True})
    assert overview(a, "2026-09-21")["announcements"]
    admin.patch("/api/admin/content/announcements/{}".format(r.json()["id"]), json={"active": False})
    assert overview(a, T)["announcements"] == []
    assert admin.delete("/api/admin/content/announcements/{}".format(r.json()["id"])).status_code == 200


def test_announcement_validation_and_limit_of_three(signup, admin):
    a = signup("a@example.com", "Alpha")
    assert admin.post("/api/admin/content/announcements", json={"title": "<x>"}).status_code == 422
    assert admin.post("/api/admin/content/announcements", json={"title": "ok title", "tone": "loud"}).status_code == 422
    for i in range(5):
        admin.post("/api/admin/content/announcements", json={"title": "News number {}".format(i)})
    assert len(overview(a, T)["announcements"]) == 3
    assert overview(a, T)["announcements"][0]["title"] == "News number 4"      # newest first


# ----------------------------- starting plans -------------------------------

PLAN = {"key": "gentle", "label": "Gentle start", "desc": "Three easy things a day.", "emoji": "🌤️",
        "quests": [{"day_type": dt, "label": "Task {} {}".format(dt, i), "time_label": "Morning", "stat": "VIT"}
                   for dt in ("weekday", "saturday", "sunday") for i in range(3)]}


def test_admin_creates_a_plan_and_a_new_member_can_choose_it(signup, admin):
    assert admin.post("/api/admin/content/templates", json=PLAN).status_code == 201
    assert admin.post("/api/admin/content/templates", json=PLAN).status_code == 409
    listed = [t for t in admin.get("/api/templates").json() if t["key"] == "gentle"]
    assert listed and listed[0]["quests"] == 9 and listed[0]["emoji"] == "🌤️" and listed[0]["preview"]
    member = signup("m@example.com", "Member", template="gentle")
    assert len(member.get("/api/quests").json()) == 9


def test_hidden_plans_cannot_be_chosen_and_builtins_cannot_be_deleted(signup, admin):
    assert admin.patch("/api/admin/content/templates/focus", json={"active": False}).status_code == 200
    assert "focus" not in [t["key"] for t in admin.get("/api/templates").json()]
    api = signup("m@example.com", "Member", onboard=False)
    r = api.post("/api/onboarding", params={"today": T},
                 json={"template": "focus", "plan_start": T, "plan_end": "2026-12-31"})
    assert r.status_code == 400
    assert admin.delete("/api/admin/content/templates/focus").status_code == 400
    admin.patch("/api/admin/content/templates/focus", json={"active": True})
    assert "focus" in [t["key"] for t in admin.get("/api/templates").json()]


def test_plan_editing_changes_what_new_members_get_but_not_existing_ones(signup, admin):
    old = signup("old@example.com", "Older", template="wellbeing")
    n_old = len(old.get("/api/quests").json())
    quests = [{"day_type": "weekday", "label": "Just one thing", "time_label": "Any time", "stat": "INT"}]
    r = admin.patch("/api/admin/content/templates/wellbeing", json={"label": "Wellbeing (short)", "quests": quests})
    assert r.status_code == 200 and r.json()["quests"] == 1
    new = signup("new@example.com", "Newer", template="wellbeing")
    assert len(new.get("/api/quests").json()) == 1
    assert len(old.get("/api/quests").json()) == n_old


def test_plan_validation(admin):
    bad = dict(PLAN, key="Bad Key")
    assert admin.post("/api/admin/content/templates", json=bad).status_code == 422
    too_many = dict(PLAN, key="toomany", quests=[{"day_type": "weekday", "label": "t{}".format(i), "stat": "VIT"}
                                                  for i in range(21)])
    assert admin.post("/api/admin/content/templates", json=too_many).status_code == 400
    assert admin.post("/api/admin/content/templates", json=dict(PLAN, key="okkey", quests=[{"day_type": "x", "label": "a", "stat": "VIT"}])).status_code == 422
    assert admin.delete("/api/admin/content/templates/nope").status_code == 404


def test_audit_records_content_changes_with_the_admin_name(admin):
    admin.post("/api/admin/content/templates", json=PLAN)
    items = admin.get("/api/admin/audit", params={"action": "content."}).json()["items"]
    assert items and items[0]["action"] == "content.template_add" and items[0]["actor_email"] == "boss@example.com"


# --------------------------- caching and migration ---------------------------

def test_hall_and_admin_rollups_are_cached_and_cleared_on_change(signup, admin, monkeypatch):
    monkeypatch.setenv("CACHE_SECONDS", "60")
    cache.clear()
    assert config.cache_seconds() == 60
    a = signup("a@example.com", "Alpha")
    first = a.get("/api/board", params={"today": T}).json()
    assert first["participants"] == 0
    # opting in clears the cache, so the member sees themselves straight away
    a.patch("/api/me", json={"public_board": True})
    assert a.get("/api/board", params={"today": T}).json()["participants"] == 1
    # the admin member list is served from the same rollup until something clears it
    assert admin.get("/api/admin/users", params={"today": T}).status_code == 200
    n = len(cache._store)
    admin.get("/api/admin/users", params={"today": T})
    assert len(cache._store) == n
    admin.patch("/api/admin/users/{}".format(a.user["id"]), json={"is_active": False})
    assert len(cache._store) == 0 or ("board", date.fromisoformat(T)) not in cache._store
    cache.clear()


def test_sprout_users_move_to_sunset(signup):
    from app import bootstrap, models
    from app.database import SessionLocal
    a = signup("a@example.com", "Alpha")
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.id == a.user["id"]).one()
        user.theme_key = "theme_sprout"
        db.commit()
        bootstrap.migrate_theme_keys(db)
        db.refresh(user)
        assert user.theme_key == "theme_sunset"
    finally:
        db.close()
    assert overview(a)["theme"]["key"] == "theme_sunset"


def test_every_theme_is_a_gradient_with_emoji_and_titles_have_emoji(client):
    items = client.get("/api/shop").json()["items"]
    assert len(items) == 14
    for i in items:
        assert i["emoji"]
        if i["kind"] == "theme":
            assert all(i[k].startswith("#") for k in ("fill", "fill2", "light", "light2", "text", "light_text"))


def test_template_listing_has_emoji_and_preview(raw):
    items = raw.get("/api/templates").json()
    assert [t["key"] for t in items] == ["wellbeing", "student", "exam_ai", "focus", "blank"]
    assert all(t["emoji"] for t in items) and items[0]["preview"] and items[-1]["preview"] == []
