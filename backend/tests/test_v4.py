"""v4 features: Daily Dares, Weekly Boss, the opt-in Hall, avatars, and the additive DB upgrade."""
from datetime import date, timedelta

from sqlalchemy import create_engine, inspect, text

from app import bootstrap, dares
from tests.conftest import PASSWORD

T = "2026-09-16"


def day(c, d, today=None):
    return c.get("/api/day/{}".format(d), params={"today": today or d}).json()


def clear_day(c, d):
    for t in day(c, d)["tasks"]:
        assert c.post("/api/completions/toggle", params={"today": d},
                      json={"quest_id": t["id"], "date": d, "completed": True}).status_code == 200


def overview(c, today):
    return c.get("/api/overview", params={"today": today}).json()


def toggle_dare(c, d, done=True, today=None):
    return c.post("/api/dares/toggle", params={"today": today or d}, json={"date": d, "completed": done})


# ------------------------------- dares -------------------------------------

def test_dare_list_is_clean_and_never_repeats_two_days_running():
    keys = [d["key"] for d in dares.DARES]
    assert len(keys) == len(set(keys))
    for uid in (1, 2, 7):
        picks = [dares.dare_for(uid, date(2026, 9, 16) + timedelta(days=i))["key"] for i in range(40)]
        assert all(a != b for a, b in zip(picks, picks[1:]))


def test_day_includes_a_dare_and_it_is_stable(client):
    a, b = day(client, T)["dare"], day(client, T)["dare"]
    assert a == b and a["done"] is False and a["xp"] == 15 and a["label"]


def test_finishing_a_dare_gives_xp_and_coins_once(client):
    before = overview(client, T)
    r = toggle_dare(client, T).json()
    assert r["xp_delta"] == 15
    after = overview(client, T)
    assert after["total_xp"] == before["total_xp"] + 15
    assert after["dares_done"] == 1
    # +5 coins for the dare, +15 milestone "Dare Accepted"
    assert after["coins"] == before["coins"] + 5 + 15
    toggle_dare(client, T, False)
    toggle_dare(client, T, True)
    again = overview(client, T)
    assert again["coins"] == after["coins"]                      # no double pay
    assert again["total_xp"] == after["total_xp"]


def test_unticking_a_dare_removes_its_xp(client):
    toggle_dare(client, T)
    toggle_dare(client, T, False)
    assert overview(client, T)["dares_done"] == 0
    assert day(client, T)["dare"]["done"] is False


def test_dare_rules(client):
    assert toggle_dare(client, "2026-09-17", True, today=T).status_code == 400      # future
    assert toggle_dare(client, "2026-09-01", True, today=T).status_code == 400      # before the plan
    assert client.post("/api/dares/toggle", params={"today": T}, json={"date": T}).status_code == 422


def test_dares_are_private_to_each_user(signup):
    a, b = signup("a@example.com", "Aa"), signup("b@example.com", "Bb")
    toggle_dare(a, T)
    assert day(b, T)["dare"]["done"] is False
    assert overview(b, T)["dares_done"] == 0


def test_dare_does_not_affect_streaks_or_perfect_days(client):
    toggle_dare(client, T)
    o = overview(client, T)
    assert o["current_streak"] == 0 and o["perfect_days"] == 0


# ------------------------------- boss --------------------------------------

def test_boss_card_for_the_first_partial_week(client):
    boss = overview(client, T)["boss"]
    # Wed, Thu, Fri = 3 weekdays x 7, Sat + Sun = 2 x 7  ->  35 quests, 80% = 28
    assert boss["week_start"] == "2026-09-14"
    assert boss["possible"] == 35 and boss["hp"] == 28 and boss["done"] == 0
    assert boss["defeated"] is False and boss["name"] and boss["days_left"] == 4


def test_boss_falls_at_eighty_percent_and_pays_once(client):
    for d in ("2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19"):
        clear_day(client, d)
    o = overview(client, "2026-09-19")
    assert o["boss"]["defeated"] and o["boss"]["remaining"] == 0 and o["bosses_defeated"] == 1
    ledger = client.get("/api/export").json()["coin_transactions"]
    assert sum(1 for t in ledger if t["reason"].startswith("Boss defeated")) == 1
    coins = o["coins"]
    for _ in range(3):
        assert overview(client, "2026-09-19")["coins"] == coins
    # 4 perfect days (28 quests x10 + 4 x20) + boss 50
    assert o["total_xp"] == 280 + 80 + 50


def test_boss_event_is_reported_when_it_falls(client):
    for d in ("2026-09-16", "2026-09-17", "2026-09-18"):
        clear_day(client, d)
    tasks = day(client, "2026-09-19")["tasks"]
    events = []
    for t in tasks:
        events += client.post("/api/completions/toggle", params={"today": "2026-09-19"},
                              json={"quest_id": t["id"], "date": "2026-09-19", "completed": True}).json()["events"]
    boss_events = [e for e in events if e["kind"] == "boss"]
    assert len(boss_events) == 1 and boss_events[0]["amount"] == 40 and boss_events[0]["boss"]


def test_a_new_week_gets_a_new_boss(client):
    boss = overview(client, "2026-09-22")["boss"]
    assert boss["week_start"] == "2026-09-21" and boss["possible"] == 49   # 5 weekdays + Sat + Sun, 7 each
    assert boss["name"] != overview(client, T)["boss"]["name"]


# ------------------------------- milestones --------------------------------

def test_new_milestones_exist_and_unlock(client):
    ids = {m["id"] for m in client.get("/api/milestones").json()}
    assert {"first_dare", "dare_10", "boss_1", "boss_4", "perfect_10", "fortnight"} <= ids
    toggle_dare(client, T)
    got = {m["id"]: m["achieved"] for m in client.get("/api/milestones").json()}
    assert got["first_dare"] is True and got["boss_1"] is False


# ------------------------------- avatar + board ----------------------------

def test_avatar_and_board_settings(client):
    assert client.get("/api/auth/me").json()["avatar"] == "spark"
    assert client.patch("/api/me", json={"avatar": "<script>"}).status_code == 422
    assert client.patch("/api/me", json={}).status_code == 400
    r = client.patch("/api/me", json={"avatar": "leaf"})
    assert r.status_code == 200 and r.json()["avatar"] == "leaf" and r.json()["name"] == "Messi"
    assert client.patch("/api/me", json={"name": "Renamed"}).json()["avatar"] == "leaf"   # partial save


def test_the_hall_is_opt_in_and_shows_no_private_fields(signup):
    a = signup("a@example.com", "Alpha")
    b = signup("b@example.com", "Bravo")
    c = signup("c@example.com", "Charlie")
    clear_day(a, T)
    clear_day(b, T)
    toggle_dare(b, T)
    a.patch("/api/me", json={"public_board": True})
    b.patch("/api/me", json={"public_board": True})
    # c never opted in
    board = c.get("/api/board", params={"today": T}).json()
    assert board["opted_in"] is False and board["me"] is None
    names = [r["name"] for r in board["rows"]]
    assert names == ["Bravo", "Alpha"]                        # Bravo has the dare's 15 XP on top
    assert {r["name"] for r in board["rows"]}.isdisjoint({"Charlie"})
    row = board["rows"][0]
    assert set(row) == {"name", "avatar", "level", "rank", "streak", "week_xp", "is_me", "place"}
    assert row["week_xp"] == 7 * 10 + 20 + 15 and row["place"] == 1
    mine = b.get("/api/board", params={"today": T}).json()
    assert mine["opted_in"] and mine["me"]["place"] == 1 and mine["rows"][0]["is_me"] is True
    # leaving the board removes you
    b.patch("/api/me", json={"public_board": False})
    assert [r["name"] for r in a.get("/api/board", params={"today": T}).json()["rows"]] == ["Alpha"]


def test_disabled_users_are_not_on_the_hall(signup, admin):
    a = signup("a@example.com", "Alpha")
    a.patch("/api/me", json={"public_board": True})
    uid = a.user["id"]
    assert admin.patch("/api/admin/users/{}".format(uid), json={"is_active": False}).status_code == 200
    b = signup("b@example.com", "Bravo")
    assert b.get("/api/board", params={"today": T}).json()["rows"] == []


def test_admin_sees_counts_but_not_which_dare(client, admin):
    toggle_dare(client, T)
    uid = client.user["id"]
    body = admin.get("/api/admin/users/{}".format(uid), params={"today": T}).text
    assert '"dares_done":1' in body.replace(" ", "")
    assert dares.dare_for(uid, date(2026, 9, 16))["label"] not in body


def test_export_includes_dares(client):
    toggle_dare(client, T)
    assert client.get("/api/export").json()["dares_done"] == [T]


def test_deleting_an_account_removes_dares(signup, raw):
    a = signup("a@example.com", "Alpha")
    toggle_dare(a, T)
    assert a.post("/api/me/delete", json={"password": PASSWORD}).status_code == 200
    from app.database import SessionLocal
    from app import models
    db = SessionLocal()
    try:
        assert db.query(models.DareDone).count() == 0
    finally:
        db.close()


# ------------------------------- upgrade from v3 ---------------------------

def test_upgrade_adds_missing_columns_and_keeps_rows(tmp_path, monkeypatch):
    eng = create_engine("sqlite:///{}".format(tmp_path / "v3.db"))
    with eng.begin() as conn:
        conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(254), name VARCHAR(40))"))
        conn.execute(text("INSERT INTO users (email, name) VALUES ('old@example.com', 'Old')"))
    monkeypatch.setattr(bootstrap, "engine", eng)
    bootstrap.ensure_columns()
    bootstrap.ensure_columns()                               # safe to repeat
    cols = {c["name"] for c in inspect(eng).get_columns("users")}
    assert {"avatar", "public_board"} <= cols
    with eng.connect() as conn:
        row = conn.execute(text("SELECT email, avatar, public_board FROM users")).one()
    assert row[0] == "old@example.com" and row[1] == "spark" and not row[2]


def test_v3_theme_keys_are_migrated(signup):
    from app import bootstrap, models
    from app.database import SessionLocal
    a = signup("a@example.com", "Alpha")
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.id == a.user["id"]).one()
        user.theme_key = "theme_glacier"
        db.add(models.Purchase(user_id=user.id, item_key="theme_glacier", cost=60))
        db.add(models.Purchase(user_id=user.id, item_key="theme_jade", cost=60))     # jade became Forest in v5
        db.commit()
        bootstrap.migrate_theme_keys(db)
        bootstrap.migrate_theme_keys(db)                     # idempotent
        db.refresh(user)
        assert user.theme_key == "theme_ocean"
        owned = {p.item_key for p in db.query(models.Purchase).filter(models.Purchase.user_id == user.id)}
        assert owned == {"theme_ocean", "theme_forest"}
    finally:
        db.close()
    shop = a.get("/api/shop").json()
    items = {i["key"]: i for i in shop["items"]}
    assert items["theme_ocean"]["owned"] and items["theme_ocean"]["equipped"]


def test_every_theme_has_light_and_dark_colours_and_titles_have_calm_names(client):
    items = client.get("/api/shop").json()["items"]
    for i in items:
        if i["kind"] == "theme":
            assert all(i[k].startswith(("#", "rgba")) for k in
                       ("fill", "fill2", "text", "on_fill", "light", "light2", "light_text", "on_light"))
        else:
            assert i["calm"]
    assert client.get("/api/overview", params={"today": T}).json()["title_calm"] == "Beginner"


def test_every_starting_plan_can_be_chosen(signup):
    for i, key in enumerate(("wellbeing", "student", "professional", "fitness", "skills", "blank")):
        api = signup("t{}@example.com".format(i), "Tester", template=key)
        n = len(api.get("/api/quests").json())
        assert (n == 0) == (key == "blank"), key
        if key != "blank":
            assert len(api.get("/api/quests", params={"day_type": "weekday"}).json()) >= 6
            assert day(api, T)["tasks"], key
