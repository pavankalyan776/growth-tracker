"""
Tracker behaviour for one signed-in hunter. Dates used:
  2026-09-16 Wed (day 1)   2026-09-17 Thu   2026-09-18 Fri   2026-09-19 Sat   2026-09-20 Sun
Every call passes ?today=... exactly like the browser does.
"""


def day(client, d, today):
    return client.get("/api/day/{}".format(d), params={"today": today}).json()


def clear_day(client, d, today=None):
    today = today or d
    for t in day(client, d, today)["tasks"]:
        r = client.post("/api/completions/toggle", params={"today": today},
                        json={"quest_id": t["id"], "date": d, "completed": True})
        assert r.status_code == 200, r.text


def overview(client, today):
    return client.get("/api/overview", params={"today": today}).json()


def test_template_quests_are_seeded_per_user(client):
    assert len(client.get("/api/quests").json()) == 21
    assert len(client.get("/api/quests", params={"day_type": "weekday"}).json()) == 7


def test_perfect_day_gives_xp_streak_and_coins(client):
    clear_day(client, "2026-09-16")
    o = overview(client, "2026-09-16")
    assert o["total_xp"] == 7 * 10 + 20           # 10 per quest + 20 perfect-day bonus
    assert o["current_streak"] == 1 and o["longest_streak"] == 1
    # login 5 + first_blood 20 + perfect day 10
    assert o["coins"] == 35
    assert o["perfect_days"] == 1
    assert o["plan"]["day"] == 1 and o["plan"]["days"] == 107


def test_toggle_reports_xp_and_gate_cleared(client):
    tasks = day(client, "2026-09-16", "2026-09-16")["tasks"]
    results = []
    for t in tasks:
        r = client.post("/api/completions/toggle", params={"today": "2026-09-16"},
                        json={"quest_id": t["id"], "date": "2026-09-16", "completed": True}).json()
        results.append(r)
    assert results[0]["xp_delta"] == 10 and not results[0]["day_cleared"]
    assert results[-1]["day_cleared"] and results[-1]["xp_delta"] == 30   # 10 + 20 perfect bonus


def test_rewards_are_not_granted_twice(client):
    clear_day(client, "2026-09-16")
    first = overview(client, "2026-09-16")["coins"]
    for _ in range(3):
        assert overview(client, "2026-09-16")["coins"] == first


def test_cannot_clear_future_days(client):
    qid = day(client, "2026-09-17", "2026-09-16")["tasks"][0]["id"]
    r = client.post("/api/completions/toggle", params={"today": "2026-09-16"},
                    json={"quest_id": qid, "date": "2026-09-17", "completed": True})
    assert r.status_code == 400


def test_cannot_clear_outside_the_plan(client):
    qid = client.get("/api/quests", params={"day_type": "weekday"}).json()[0]["id"]
    r = client.post("/api/completions/toggle", params={"today": "2026-09-16"},
                    json={"quest_id": qid, "date": "2026-09-15", "completed": True})
    assert r.status_code == 400


def test_quest_must_match_the_day_type(client):
    sat_quest = client.get("/api/quests", params={"day_type": "saturday"}).json()[0]["id"]
    r = client.post("/api/completions/toggle", params={"today": "2026-09-18"},
                    json={"quest_id": sat_quest, "date": "2026-09-18", "completed": True})
    assert r.status_code == 400


def test_unfinished_today_does_not_break_the_streak(client):
    clear_day(client, "2026-09-16")
    # It's now the 17th and nothing is done yet: streak must still read 1, not 0.
    o = overview(client, "2026-09-17")
    assert o["current_streak"] == 1
    assert o["streak_at_risk"] is True


def test_missed_day_breaks_streak_and_shield_repairs_it(client):
    clear_day(client, "2026-09-16")
    overview(client, "2026-09-17")                       # login bonus
    o = overview(client, "2026-09-18")                   # login bonus; the 17th is now missed
    assert o["current_streak"] == 0
    assert o["penalty"]["date"] == "2026-09-17"
    assert o["coins"] == 45                              # 35 + two logins

    r = client.post("/api/shields", params={"today": "2026-09-18"}, json={"date": "2026-09-17"})
    assert r.status_code == 200
    o = overview(client, "2026-09-18")
    assert o["coins"] == 15                              # 45 - 30
    assert o["current_streak"] == 2                      # 16th perfect + 17th shielded
    assert o["penalty"] is None
    # shielding gives no XP: stats stay honest
    assert o["total_xp"] == 90


def test_shield_rules(client):
    # not enough coins
    r = client.post("/api/shields", params={"today": "2026-09-18"}, json={"date": "2026-09-17"})
    assert r.status_code == 400
    # can't shield today or the future
    r = client.post("/api/shields", params={"today": "2026-09-18"}, json={"date": "2026-09-18"})
    assert r.status_code == 400


def test_quest_crud(client):
    created = client.post("/api/quests", json={"day_type": "weekday", "label": "Read 20 min",
                                               "time_label": "9:30 PM", "stat": "INT"})
    assert created.status_code == 201
    qid = created.json()["id"]
    assert client.put("/api/quests/{}".format(qid), json={"label": "Read 30 min"}).json()["label"] == "Read 30 min"
    assert len(client.get("/api/quests", params={"day_type": "weekday"}).json()) == 8
    assert client.delete("/api/quests/{}".format(qid)).status_code == 200
    assert client.delete("/api/quests/{}".format(qid)).status_code == 404
    assert len(client.get("/api/quests", params={"day_type": "weekday"}).json()) == 7


def test_quest_validation(client):
    bad = client.post("/api/quests", json={"day_type": "funday", "label": "x", "stat": "STR"})
    assert bad.status_code == 422
    bad = client.post("/api/quests", json={"day_type": "weekday", "label": "x", "stat": "XYZ"})
    assert bad.status_code == 422


def test_deleting_a_quest_removes_its_completions(client):
    clear_day(client, "2026-09-16")
    qid = client.get("/api/quests", params={"day_type": "weekday"}).json()[0]["id"]
    assert client.delete("/api/quests/{}".format(qid)).status_code == 200
    assert len(client.get("/api/export").json()["completions"]) == 6


def test_journal_crud_and_failure_ledger(client):
    r = client.put("/api/journal/2026-09-16", params={"today": "2026-09-16"},
                   json={"mood": 2, "note": "Rough one", "struggle": "Could not wake up"})
    assert r.status_code == 200
    assert client.get("/api/journal/2026-09-16").json()["mood"] == 2
    client.put("/api/journal/2026-09-16", params={"today": "2026-09-16"},
               json={"mood": 4, "note": "Better", "struggle": "Could not wake up"})
    assert client.get("/api/journal/2026-09-16").json()["mood"] == 4
    assert len(client.get("/api/journal").json()) == 1
    a = client.get("/api/analytics", params={"today": "2026-09-18"}).json()
    entry = [m for m in a["missed"] if m["date"] == "2026-09-16"][0]
    assert entry["struggle"] == "Could not wake up"
    assert client.put("/api/journal/2026-09-20", params={"today": "2026-09-16"},
                      json={"mood": 3}).status_code == 400
    assert client.delete("/api/journal/2026-09-16").status_code == 200
    assert client.get("/api/journal/2026-09-16").status_code == 404


def test_journal_validation(client):
    r = client.put("/api/journal/2026-09-16", params={"today": "2026-09-16"}, json={"mood": 9})
    assert r.status_code == 422


def test_calendar_heatmap_and_analytics_shapes(client):
    clear_day(client, "2026-09-16")
    cal = client.get("/api/calendar", params={"month": "2026-09", "today": "2026-09-17"}).json()
    assert len(cal["days"]) == 30
    d16 = [d for d in cal["days"] if d["date"] == "2026-09-16"][0]
    assert d16["pct"] == 100 and d16["in_plan"]
    d10 = [d for d in cal["days"] if d["date"] == "2026-09-10"][0]
    assert not d10["in_plan"]
    assert client.get("/api/calendar", params={"month": "nonsense"}).status_code == 400

    heat = client.get("/api/heatmap", params={"today": "2026-09-17"}).json()
    assert len(heat) == 107
    assert heat[0]["pct"] == 100 and heat[-1]["pct"] is None

    a = client.get("/api/analytics", params={"today": "2026-09-17"}).json()
    assert a["summary"]["perfect_days"] == 1
    assert a["summary"]["tracked_days"] == 2
    assert len(a["per_stat"]) == 5 and len(a["weekday"]) == 7


def test_monthly_achievement_coins(client):
    import datetime
    d = datetime.date(2026, 9, 16)
    while d <= datetime.date(2026, 9, 30):
        clear_day(client, d.isoformat(), "2026-10-01")
        d += datetime.timedelta(days=1)
    overview(client, "2026-10-01")
    txs = client.get("/api/export").json()["coin_transactions"]
    assert [t for t in txs if t["reason"] == "Monthly achievement 2026-09"][0]["amount"] == 100
    overview(client, "2026-10-02")
    txs = client.get("/api/export").json()["coin_transactions"]
    assert len([t for t in txs if t["reason"].startswith("Monthly achievement")]) == 1


def test_shop_buy_equip_rules(client):
    shop = client.get("/api/shop").json()
    assert shop["coins"] == 0
    keys = {i["key"]: i for i in shop["items"]}
    assert keys["title_rookie"]["owned"] and keys["theme_arise"]["owned"]
    assert client.post("/api/shop/buy", json={"key": "title_riser"}).status_code == 400
    assert client.post("/api/shop/equip", json={"key": "title_riser"}).status_code == 400
    for d in ("2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"):
        clear_day(client, d)
    assert overview(client, "2026-09-20")["coins"] >= 60
    assert client.post("/api/shop/buy", params={"today": "2026-09-20"},
                       json={"key": "theme_jade"}).status_code == 200
    assert client.post("/api/shop/buy", params={"today": "2026-09-20"},
                       json={"key": "theme_jade"}).status_code == 400   # already owned
    client.post("/api/shop/equip", json={"key": "theme_jade"})
    assert overview(client, "2026-09-20")["theme"]["fill"] == "#2FD6A0"


def test_export_contains_everything_and_only_your_data(client):
    clear_day(client, "2026-09-16")
    data = client.get("/api/export").json()
    for key in ("hunter", "quests", "completions", "shields", "journal", "coin_transactions",
                "milestones", "purchases"):
        assert key in data
    assert len(data["completions"]) == 7


def test_blank_template_and_shorter_plan(signup):
    api = signup(email="blank@example.com", name="Blanky", template="blank")
    assert api.get("/api/quests").json() == []
    o = api.get("/api/overview", params={"today": "2026-09-16"}).json()
    assert o["today_score"]["total"] == 0 and o["penalty"] is None
    q = api.post("/api/quests", json={"day_type": "weekday", "label": "Walk", "stat": "STR"}).json()
    r = api.post("/api/completions/toggle", params={"today": "2026-09-16"},
                 json={"quest_id": q["id"], "date": "2026-09-16", "completed": True})
    assert r.json()["day_cleared"] is True


def test_milestones_use_the_personal_plan(signup):
    api = signup(email="short@example.com", name="Shorty")
    api.put("/api/plan", params={"today": "2026-09-16"},
            json={"plan_start": "2026-09-16", "plan_end": "2026-09-30"})
    api.get("/api/overview", params={"today": "2026-09-30"})
    done = {m["id"] for m in api.get("/api/milestones").json() if m["achieved"]}
    assert {"halfway", "finisher"} <= done
